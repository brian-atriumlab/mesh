import axios, { AxiosInstance } from 'axios';
import { SUPPORTED_HANDLES } from '@mesh/common/constants';
import { IFetcher, ISubmitter } from '@mesh/common/contracts';
import {
  fromUTF8,
  parseAssetUnit,
  parseHttpError,
  resolveRewardAddress,
  toBytes,
  toScriptRef,
} from '@mesh/common/utils';
import type {
  AccountInfo,
  Asset,
  AssetMetadata,
  BlockInfo,
  NativeScript,
  PlutusScript,
  Protocol,
  TransactionInfo,
  UTxO,
} from '@mesh/common/types';

export type MaestroSupportedNetworks = "Mainnet" | "Preprod" | "Preview"

export interface MaestroConfig {
  network: MaestroSupportedNetworks,
  apiKey: string,
  turboSubmit?: boolean  // Read about paid turbo transaction submission feature at https://docs-v1.gomaestro.org/docs/Dapp%20Platform/Turbo%20Transaction.
}

export class MaestroProvider implements IFetcher, ISubmitter {
  private readonly _axiosInstance: AxiosInstance;

  turboSubmit: boolean;

  constructor({ network, apiKey, turboSubmit = false }: MaestroConfig) {
    this._axiosInstance = axios.create({
      baseURL: `https://${network}.gomaestro-api.org/v1`,
      headers: { 'api-key': apiKey },
    });
    this.turboSubmit = turboSubmit;
  }

  async fetchAccountInfo(address: string): Promise<AccountInfo> {
    const rewardAddress = address.startsWith('addr')
      ? resolveRewardAddress(address)
      : address;

    try {
      const { data: timestampedData, status } = await this._axiosInstance.get(
        `accounts/${rewardAddress}`
      );

      if (status === 200) {
        const data = timestampedData.data;
        return <AccountInfo>{
          poolId: data.delegated_pool,
          active: data.registered,
          balance: data.total_balance.toString(),
          rewards: data.total_rewarded.toString(),
          withdrawals: data.total_withdrawn.toString(),
        };
      }

      throw parseHttpError(timestampedData);
    } catch (error) {
      throw parseHttpError(error);
    }
  }

  async fetchAddressUTxOs(address: string, asset?: string): Promise<UTxO[]> {
    const queryPredicate = (() => {
      if (address.startsWith('addr_vkh') || address.startsWith('addr_shared_vkh')) return `addresses/cred/${address}`
      else return `addresses/${address}`;
    })();
    const resolveScript = (utxo: MaestroUTxO) => {
      if (utxo.reference_script) {
        const script =
          utxo.reference_script.type === "native"
            ? <NativeScript>utxo.reference_script.json
            : <PlutusScript>{
              code: utxo.reference_script.bytes,
              version: utxo.reference_script.type.replace('plutusv', 'V')
            }
        return toScriptRef(script).to_hex()

      } else return undefined
    }
    const paginateUTxOs = async (
      cursor = null,
      utxos: UTxO[] = []
    ): Promise<UTxO[]> => {
      const appendCursorString = cursor === null ? "" : `&cursor=${cursor}`
      const { data: timestampedData, status } = await this._axiosInstance.get(
        `${queryPredicate}/utxos?count=100${appendCursorString}`
      );
      if (status === 200) {
        const data = timestampedData.data;
        let pageUTxOs: UTxO[] = data.map(toUTxO);
        if (asset !== undefined && asset !== '')
          pageUTxOs = pageUTxOs.filter((utxo) => utxo.output.amount.some((a) => a.unit === asset));
        const addedUtxos = [...utxos, ...pageUTxOs]
        const nextCursor = timestampedData.next_cursor;
        return nextCursor == null ? addedUtxos : paginateUTxOs(nextCursor, addedUtxos)
      }

      throw parseHttpError(timestampedData);
    };

    const toUTxO = (utxo: MaestroUTxO): UTxO => ({
      input: {
        outputIndex: utxo.index,
        txHash: utxo.tx_hash,
      },
      output: {
        address: address,
        amount: utxo.assets.map((asset) => ({
          unit: asset.unit,
          quantity: asset.amount.toString(),
        })),
        dataHash: utxo.datum?.hash,
        plutusData: utxo.datum?.bytes,
        scriptRef: resolveScript(utxo),
      },
    });

    try {
      return await paginateUTxOs();
    } catch (error) {
      return [];
    }
  }

  async fetchAssetAddresses(asset: string): Promise<{ address: string; quantity: string }[]> {
    const paginateAddresses = async (
      cursor = null,
      addressesWithQuantity: { address: string; quantity: string }[] = []
    ): Promise<{ address: string; quantity: string }[]> => {
      const appendCursorString = cursor === null ? "" : `&cursor=${cursor}`
      const { policyId, assetName } = parseAssetUnit(asset);
      const { data: timestampedData, status } = await this._axiosInstance.get(
        `assets/${policyId}${assetName}/addresses?count=100${appendCursorString}`
      );
      if (status === 200) {
        const data = timestampedData.data;
        const pageAddressesWithQuantity: { address: string; quantity: string }[] = data.map((a) => { return { address: a.address, quantity: a.amount.toString() } })
        const nextCursor = timestampedData.next_cursor;
        const addedData = [...addressesWithQuantity, ...pageAddressesWithQuantity]
        return nextCursor == null ? addedData : paginateAddresses(nextCursor, addedData)

      }

      throw parseHttpError(timestampedData);
    };

    try {
      return await paginateAddresses();
    } catch (error) {
      return [];
    }
  }

  async fetchAssetMetadata(asset: string): Promise<AssetMetadata> {
    try {
      const { policyId, assetName } = parseAssetUnit(asset);
      const { data, status } = await this._axiosInstance.get(
        `assets/${policyId}${assetName}`
      );

      if (status === 200)
        return <AssetMetadata>{
          ...data.asset_standards.cip25_metadata, ...data.asset_standards.cip68_metadata,
        };

      throw parseHttpError(data);
    } catch (error) {
      throw parseHttpError(error);
    }
  }

  async fetchBlockInfo(hash: string): Promise<BlockInfo> {

    throw new Error('not implemented.');

    try {
      const { data, status } = await this._axiosInstance.get(`blocks/${hash}`);

      if (status === 200)
        return <BlockInfo>{
          confirmations: data.confirmations,
          epoch: data.epoch,
          epochSlot: data.epoch_slot.toString(),
          fees: data.fees,
          hash: data.hash,
          nextBlock: data.next_block ?? '',
          operationalCertificate: data.op_cert,
          output: data.output ?? '0',
          previousBlock: data.previous_block,
          size: data.size,
          slot: data.slot.toString(),
          slotLeader: data.slot_leader ?? '',
          time: data.time,
          txCount: data.tx_count,
          VRFKey: data.block_vrf,
        };

      throw parseHttpError(data);
    } catch (error) {
      throw parseHttpError(error);
    }
  }

  async fetchCollectionAssets(
    policyId: string,
    cursor = 1
  ): Promise<{ assets: Asset[]; next: string | number | null }> {
    try {
      const { data, status } = await this._axiosInstance.get(
        `assets/policy/${policyId}?page=${cursor}`
      );

      if (status === 200)
        return {
          assets: data.map((asset) => ({
            unit: policyId + asset.asset_name,
            quantity: asset.total_supply.toString(),
          })),
          next: data.length === 100 ? cursor + 1 : null,
        };

      throw parseHttpError(data);
    } catch (error) {
      return { assets: [], next: null };
    }
  }

  async fetchHandleAddress(handle: string): Promise<string> {

    throw new Error('not implemented.');

    try {
      const assetName = fromUTF8(handle.replace('$', ''));
      const { data, status } = await this._axiosInstance.get(
        `assets/${SUPPORTED_HANDLES[1]}${assetName}/addresses`
      );

      if (status === 200) return data[0].address;

      throw parseHttpError(data);
    } catch (error) {
      throw parseHttpError(error);
    }
  }

  async fetchProtocolParameters(epoch = Number.NaN): Promise<Protocol> {

    if (!isNaN(epoch)) throw new Error('Maestro only supports fetching Protocol parameters of the latest epoch.')

    // Decimal numbers in Maestro are given as ratio of two numbers represented by string of format "firstNumber/secondNumber".
    const decimalFromRationalString = (str: string): number => {
      const forwardSlashIndex = str.indexOf("/");
      return parseInt(str.slice(0, forwardSlashIndex)) / parseInt(str.slice(forwardSlashIndex + 1));
    }

    try {
      const { data, status } = await this._axiosInstance.get("protocol-params");
      if (status === 200) {
        try {
          const { data: epochData, status: epochStatus } = await this._axiosInstance.get("epochs/current");

          if (epochStatus === 200)
            return <Protocol>{
              coinsPerUTxOSize: data.coins_per_utxo_byte.toString(),
              collateralPercent: parseInt(data.collateral_percentage),
              decentralisation: 0,  // Deprecated in Babbage era.
              epoch: parseInt(epochData.epoch_no),
              keyDeposit: data.stake_key_deposit.toString(),
              maxBlockExMem: data.max_execution_units_per_block.memory.toString(),
              maxBlockExSteps: data.max_execution_units_per_block.steps.toString(),
              maxBlockHeaderSize: parseInt(data.max_block_header_size),
              maxBlockSize: parseInt(data.max_block_body_size),
              maxCollateralInputs: parseInt(data.max_collateral_inputs),
              maxTxExMem: data.max_execution_units_per_transaction.memory.toString(),
              maxTxExSteps: data.max_execution_units_per_transaction.steps.toString(),
              maxTxSize: parseInt(data.max_tx_size),
              maxValSize: data.max_value_size.toString(),
              minFeeA: data.min_fee_coefficient,
              minFeeB: data.min_fee_constant,
              minPoolCost: data.min_pool_cost.toString(),
              poolDeposit: data.pool_deposit.toString(),
              priceMem: decimalFromRationalString(data.prices.memory),
              priceStep: decimalFromRationalString(data.prices.steps),
            };
          throw parseHttpError(data);
        } catch (error) {
          throw parseHttpError(error);
        }
      }
      throw parseHttpError(data);
    } catch (error) {
      throw parseHttpError(error);
    }
  }

  async fetchTxInfo(hash: string): Promise<TransactionInfo> {
    try {
      const { data, status } = await this._axiosInstance.get(`transactions/${hash}`);

      if (status === 200) {
        const { data: txCborData, status: txCborFetchStatus } = await this._axiosInstance.get(`transactions/${hash}/cbor`);
        if (txCborFetchStatus === 200) {
          return <TransactionInfo>{
            block: data.block_hash,
            deposit: data.deposit.toString(),
            fees: data.fee.toString(),
            hash: data.tx_hash,
            index: data.block_tx_index,
            invalidAfter: data.invalid_hereafter ?? '',
            invalidBefore: data.invalid_before ?? '',
            slot: data.block_absolute_slot.toString(),
            size: txCborData.cbor.length / 2 - 1,
          };
        }
      }
      throw parseHttpError(data);
    } catch (error) {
      throw parseHttpError(error);
    }
  }

  onTxConfirmed(txHash: string, callback: () => void, limit = 20): void {
    let attempts = 0;

    const checkTx = setInterval(() => {
      if (attempts >= limit)
        clearInterval(checkTx);

      this._axiosInstance.get(`txmanager/${txHash}`).then(({ data: txData, status }) => {
        if (status !== 200) {
          throw parseHttpError(txData);
        }
        if (txData.state == "Confirmed") {
          clearInterval(checkTx);
          callback();
        } // else attemps += 1 // ?
      }).catch(() => { attempts += 1; });
    }, 5_000);
  }

  async submitTx(tx: string): Promise<string> {
    try {
      const headers = { 'Content-Type': 'application/cbor' };
      const { data, status } = await this._axiosInstance.post(
        'txmanager',
        toBytes(tx),
        { headers }
      );

      if (status === 202) return data;

      throw parseHttpError(data);
    } catch (error) {
      throw parseHttpError(error);
    }
  }
}

type MaestroDatumOptionType = "hash" | "inline";

type MaestroDatumOption = {
  type: MaestroDatumOptionType;
  hash: string;
  bytes?: string; // Hex encoded datum CBOR bytes (`null` if datum type is `hash` and corresponding datum bytes have not been seen on-chain).
  json?: Json;
};

type MaestroScriptType = "native" | "plutusv1" | "plutusv2";

type Json = any;

type MaestroScript = {
  hash: string;
  type: MaestroScriptType;
  bytes?: string; // Script bytes (`null` if `native` script).
  json?: Json;
};

type MaestroAsset = {
  unit: string;
  amount: number;
};

type MaestroUTxO = {
  tx_hash: string;
  index: number;
  assets: Array<MaestroAsset>;
  address: string;
  datum?: MaestroDatumOption;
  reference_script?: MaestroScript;
  // Other fields such as `slot` & `txout_cbor` are ignored.
};
