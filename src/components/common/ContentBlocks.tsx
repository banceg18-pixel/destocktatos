import type { ContentBlock } from "@/lib/cms/types";

export interface BlockClasses {
  h2?: string;
  h3?: string;
  h4?: string;
  p?: string;
  ul?: string;
  li?: string;
}

/** Rendu des blocs éditoriaux issus du CMS (titres, paragraphes, listes, HTML nettoyé). */
export function ContentBlocks({ blocks, classes = {} }: { blocks: ContentBlock[]; classes?: BlockClasses }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading": {
            const cls = b.level === 2 ? classes.h2 : b.level === 3 ? classes.h3 : classes.h4;
            if (b.level === 2) return <h2 className={cls} key={i}>{b.text}</h2>;
            if (b.level === 3) return <h3 className={cls} key={i}>{b.text}</h3>;
            return <h4 className={cls} key={i}>{b.text}</h4>;
          }
          case "paragraph":
            return (
              <p className={classes.p} key={i}>
                {b.text}
              </p>
            );
          case "list":
            return (
              <ul className={classes.ul} key={i}>
                {b.items.map((it, j) => (
                  <li className={classes.li} key={j}>
                    {it}
                  </li>
                ))}
              </ul>
            );
          case "html":
            // Le HTML provient du CMS de confiance ; les balises <script> sont retirées par précaution.
            return <div key={i} dangerouslySetInnerHTML={{ __html: b.html.replace(/<script[\s\S]*?<\/script>/gi, "") }} />;
          default:
            return null;
        }
      })}
    </>
  );
}

export default ContentBlocks;
