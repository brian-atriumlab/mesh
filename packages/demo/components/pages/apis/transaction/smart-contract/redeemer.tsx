import { useEffect, useState } from 'react';
import Codeblock from '../../../../ui/codeblock';
import SectionTwoCol from '../../../../common/sectionTwoCol';

export default function UsingRedeemer() {
  return (
    <SectionTwoCol
      sidebarTo="redeemer"
      header="Using Redeemer"
      leftFn={Left({})}
      rightFn={Right({})}
    />
  );
}

function Left({}) {
  const [codeSnippetHaskellRedeemer, setCodeSnippetHaskellRedeemer] =
    useState('');
  const [codeSnippetFirstRedeemer, setCodeSnippetFirstRedeemer] = useState('');
  const [codeSnippetSecondRedeemer, setCodeSnippetSecondRedeemer] =
    useState('');
  const [codeSnippetThirdRedeemer, setCodeSnippetThirdRedeemer] = useState('');
  const [codeSnippetRedeemer, setCodeSnippetRedeemer] = useState('');
  useState('');

  useEffect(() => {
    // haskell redeemer type
    let haskellRedeemer = '-- The Redeemer data type in Plutus\n';
    haskellRedeemer +=
      'data MyRedeemer = StartRedeemer PaymentPubKeyHash | SecondRedeemer | EndRedeemer\n';
    haskellRedeemer +=
      "PlutusTx.makeIsDataIndexed ''MyRedeemer [('StartRedeemer,0),('SecondRedeemer,1),('EndRedeemer,2)]";
    setCodeSnippetHaskellRedeemer(haskellRedeemer);

    // 1st redeemer
    let firstRedeemer = '';
    firstRedeemer += 'const addresses = await wallet.getUsedAddresses();\n';
    firstRedeemer += 'const pkh = resolvePaymentKeyHash(addresses[0]);\n';
    firstRedeemer += 'const redeemer = {\n';
    firstRedeemer += '  data: { alternative: 0, fields: [pkh]},\n';
    firstRedeemer += '};\n';
    setCodeSnippetFirstRedeemer(firstRedeemer);
    // 2nd redeemer
    let secondRedeemer = 'const redeemer = {\n';
    secondRedeemer += '  data: { alternative: 1, fields: []},\n';
    secondRedeemer += '};\n';
    setCodeSnippetSecondRedeemer(secondRedeemer);
    // 1st redeemer
    let thirdRedeemer = 'const redeemer = {\n';
    thirdRedeemer += '  data: { alternative: 2, fields: []},\n';
    thirdRedeemer += '};\n';
    setCodeSnippetThirdRedeemer(thirdRedeemer);
    let txWithRedeemer = 'const tx = new Transaction({ initiator: wallet })\n';
    // txWithRedeemer +=
    //   "  .redeemValue('4e4d01000033222220051200120011', assetUtxo, { datum: 'supersecret', redeemer: redeemer })\n";
    txWithRedeemer += `  .redeemValue(\n`;
    txWithRedeemer += `    '4e4d01000033222220051200120011',\n`;
    txWithRedeemer += `    assetUtxo,\n`;
    txWithRedeemer += `    { datum: 'supersecret', redeemer: redeemer }\n`;
    txWithRedeemer += `  )\n`;
    txWithRedeemer += '  .sendValue(address, assetUtxo)\n';
    txWithRedeemer += '  .setRequiredSigners([address]);';
    setCodeSnippetRedeemer(txWithRedeemer);
  });

  return (
    <>
      <p>
        For redeemers in Mesh, you use the type <code>Action</code> and you only supply the{' '}
        <code>Data</code> part to construct it.
      </p>

      <Codeblock
        data={`import { resolvePaymentKeyHash } from '@meshsdk/core';\nimport type { Data } from '@meshsdk/core';`}
        isJson={false}
      />
      <Codeblock
        data={codeSnippetHaskellRedeemer}
        isJson={false}
        language="language-hs"
      />
      <h3>Designing Redeemer</h3>
      <p>
        Similarly to the datum, there is freedom in design to suit any smart contract, but the redeemer
        needs to be supplied a little differently.
      </p>
      <p>
        In this example, we represent a redeemer which matches the <code>StartRedeemer</code>
        as defined above with the first{' '}
        <code>Used Address</code> as input:
      </p>
      <Codeblock data={codeSnippetFirstRedeemer} isJson={false} />
      <p>
        Supplying the <code>SecondRedeemer</code> as defined above:
      </p>
      <Codeblock data={codeSnippetSecondRedeemer} isJson={false} />
      <p>
        Supplying the <code>EndRedeemer</code> as defined above:
      </p>
      <Codeblock data={codeSnippetThirdRedeemer} isJson={false} />
      <h3>Transaction construction</h3>
      <p>
        Within the transaction, we can include the redeemer within <code>redeemValue</code>:
      </p>
      <Codeblock data={codeSnippetRedeemer} isJson={false} />
    </>
  );
}

function Right({}) {
  return <></>;
}
