import { useEffect, useState } from "react";
import { MDXProvider } from "@mdx-js/react";

import Codeblock from "~/components/text/codeblock";

export default function Markdown({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (mounted)
    return (
      <MDXProvider
        components={{
          //@ts-ignore
          pre: (props) => <Codeblock data={props.children.props.children} />,
        }}
      >
        {children}
      </MDXProvider>
    );
}
