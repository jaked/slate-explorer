import parseXml from 'https://cdn.skypack.dev/pin/@rgrove/parse-xml@v3.0.0-jMFe7mSMYStpUfnUTz7K/mode=imports/optimized/@rgrove/parse-xml.js';
import XMLWriter from 'https://cdn.skypack.dev/pin/xml-writer@v1.7.0-r8i5k18ngLdXbG8rwkMZ/mode=imports/optimized/xml-writer.js';
import Editor from 'https://cdn.skypack.dev/pin/react-simple-code-editor@v0.11.0-vp8sfAAurbJN9zEtyguq/mode=imports/optimized/react-simple-code-editor.js';
import Prism from 'https://cdn.skypack.dev/pin/prismjs@v1.23.0-ozzTU6wrQIkYMK5IAk61/mode=imports/unoptimized/components/prism-core.js';
import 'https://cdn.skypack.dev/pin/prismjs@v1.23.0-ozzTU6wrQIkYMK5IAk61/mode=imports/unoptimized/components/prism-clike.js';
import 'https://cdn.skypack.dev/pin/prismjs@v1.23.0-ozzTU6wrQIkYMK5IAk61/mode=imports/unoptimized/components/prism-javascript.js';
import 'https://cdn.skypack.dev/pin/prismjs@v1.23.0-ozzTU6wrQIkYMK5IAk61/mode=imports/unoptimized/components/prism-markup.js';
import * as Slate from 'https://cdn.skypack.dev/pin/slate@v0.63.0-TfTTwdDci10dBArwYYLt/mode=imports/optimized/slate.js';
import * as SlateHistory from 'https://cdn.skypack.dev/pin/slate-history@v0.62.0-zGj7QlfqPEPT4eVeAZGN/mode=imports/optimized/slate-history.js';
import * as SlateHyperscript from 'https://cdn.skypack.dev/pin/slate-hyperscript@v0.62.0-InTixSbjzwTyhqYbrm6c/mode=imports/optimized/slate-hyperscript.js';

// these can't yet be converted to use Skypack because https://github.com/skypackjs/skypack-cdn/issues/142
// import * as SlateReact from 'https://cdn.skypack.dev/slate-react';
// import React from 'https://cdn.skypack.dev/react';
// import ReactDOM from 'https://cdn.skypack.dev/react-dom';

/* turn off JSHint warnings in Glitch: */
/* globals React, ReactDOM, SlateReact */

const useLocalStorage = (label, init, fromStorage, toStorage) => {
  const storageValue = localStorage.getItem(label);
  const [value, setValue] = React.useState(
    storageValue
      ? fromStorage
        ? fromStorage(storageValue)
        : storageValue
      : init()
  );
  const setLocalValue = React.useCallback(
    value => {
      localStorage.setItem(label, toStorage ? toStorage(value) : value);
      setValue(value);
    },
    [label, setValue]
  );
  return [value, setLocalValue];
};

const jsx = SlateHyperscript.createHyperscript({
  elements: {
    block: { type: "block" },
    inline: { type: "inline" },
    void: { type: "void" },
    p: { type: "p" },
    h1: { type: "h1" },
    h2: { type: "h2" },
    h3: { type: "h3" },
    ul: { type: "ul" },
    li: { type: "li" },
  }
});

const withTypes = editor => {
  const { isInline, isVoid } = editor;
  editor.isInline = element => {
    return element.type === "inline" ? true : isInline(element);
  };
  editor.isVoid = element => {
    return element.type === "void" ? true : isVoid(element);
  };
  return editor;
};

const xmlToSlate = string => {
  const xmlToSlate = xml => {
    switch (xml.type) {
      case "document":
        // it's an XML parse error to have != 1 child
        return xmlToSlate(xml.children[0]);
      case "element":
        return jsx(
          xml.name,
          // xml.attributes has some JS magic that SlateHyperscript.jsx doesn't like
          // copy it to get a plain object
          { ...xml.attributes },
          xml.children
            .map(xmlToSlate)
            // filter out all-whitespace text nodes like JSX
            .filter(node => typeof node != "string" || /\S/.test(node))
        );
      case "text":
        // JSX trims whitespace at start / end
        // and also collapses interior whitespace to a single space.
        // this makes it hard to preserve space in Slate tree
        // and also hard to roundtrip XML -> Slate -> XML.
        // instead trim newline + whitespace at start / end
        // and collapse interior newline + whitespace to single space
        // since Slate tree doesn't usually contain newlines
        // but they are inserted by XML formatting.
        return xml.text.replace(/^\n\s*/, '').replace(/\n\s*$/, '').replace(/\n\s*/g, ' ');
      default:
        throw new Error("unexpected XML type");
    }
  };
  const editor = withTypes(xmlToSlate(parseXml(string)));
  Slate.Editor.normalize(editor, { force: true });
  return editor;
};

const slateToXml = editor => {
  const slateToXml = (xw, path, node, selection) => {
    if (Slate.Editor.isEditor(node)) {
      xw.startElement("editor");
      node.children.forEach((child, i) => {
        slateToXml(xw, path.concat(i), child, selection);
      });
      xw.endElement();

    } else if (Slate.Element.isElement(node)) {
      xw.startElement('type' in node ? node.type : 'element');
      Object.keys(node).forEach(key => {
        if (key !== 'type' && key !== 'children') {
          xw.writeAttribute(key, node[key]);
        }
      });
      node.children.forEach((child, i) => {
        slateToXml(xw, path.concat(i), child, selection);
      });
      xw.endElement();

    } else if (Slate.Text.isText(node)) {
      // compute list of offsets where we need to insert a selection tag
      const { anchor = null, focus = null } = selection || {};
      const anchorOffset =
        anchor && (Slate.Path.equals(path, anchor.path) ? anchor.offset : null);
      const focusOffset =
        focus && (Slate.Path.equals(path, focus.path) ? focus.offset : null);
      // filter out nulls and duplicates
      let offsets = [anchorOffset, focusOffset].filter(
        (offset, index, self) =>
          offset !== null && self.indexOf(offset) === index
      );
      offsets.sort((a, b) => (a - b));

      // write text, inserting selection tag as needed
      xw.indent = false;
      if (Object.keys(node).length > 1) {
        xw.startElement('text');
        Object.keys(node).forEach(key => {
          if (key !== 'text') {
            xw.writeAttribute(key, node[key]);
          }
        });
      }
      let lastOffset = 0;
      for (const offset of offsets) {
        if (offset > lastOffset) {
          xw.text(node.text.substring(lastOffset, offset));
          lastOffset = offset;
        }
        if (offset === anchorOffset && offset === focusOffset)
          xw.startElement("cursor").endElement();
        else if (offset === anchorOffset)
          xw.startElement("anchor").endElement();
        else if (offset === focusOffset)
          xw.startElement("focus").endElement();
        else throw new Error("expected anchor or focus");
      }
      if (lastOffset < node.text.length) {
        xw.text(node.text.substring(lastOffset));
      }
      if (Object.keys(node).length > 1) {
        xw.endElement();
      }
      xw.indent = true;
    } else throw new Error(`expected Slate node type ${node}`);
  };

  const xw = new XMLWriter("  ");
  slateToXml(xw, [], editor, editor.selection);
  return xw.toString();
};

const e = React.createElement;

const ScrollBox = ({ gridArea, children }) => {
  return e(
    "div",
    {
      style: {
        backgroundColor: 'white',
        gridArea,
        overflow: "scroll",
        margin: "5px",
        padding: "5px",
        borderRadius: "10px",
        borderStyle: "solid",
        borderWidth: "1px"
      }
    },
    children
  );
};

const Label = (props) => {
  const { gridArea, children, justifySelf = "end", element = "h3" } = props;
  return e(
    "div",
    {
      style: {
        gridArea,
        justifySelf
      }
    },
    e(element, {}, children)
  );
};

const renderLeaf = ({ leaf, attributes, children }) =>
  e(
    'span',
    { ...attributes,
      style: {
        ...(leaf.bold ? { fontWeight: 'bold' } : {}),
        ...(leaf.italic ? { fontStyle: 'italic' } : {}),
      }
    },
    children
  )

const renderElement = ({ element, attributes, children }) => {
  switch (element.type) {
    case 'p':
    case 'h1':
    case 'h2':
    case 'h3':
    case 'ul':
    case 'li':
      return e(element.type, attributes, children);
    
    case 'inline':
      return e('span', attributes, children);

    case 'block':
      return e(
        'div',
        { ...attributes,
          style: {
            margin: "2px",
            padding: "2px",
            borderRadius: "5px",
            borderStyle: "solid",
            borderWidth: "1px"
          }
        },
        children
      );

    default:
  }
}

const SlateEditor = ({ gridArea, editor, value, setValue }) => {
  return e(
    ScrollBox,
    {
      gridArea
    },
    e(
      SlateReact.Slate,
      {
        editor,
        value,
        onChange: setValue
      },
      e(
        SlateReact.Editable,
        {
          renderLeaf,
          renderElement,
        }
      )
    )
  );
};

const CodeEditor = ({ gridArea, value, setValue, language }) => {
  const highlight = code => Prism.highlight(code, language);

  return e(
    ScrollBox,
    {
      gridArea
    },
    e(Editor, {
      value,
      onValueChange: setValue,
      highlight,
      style: {
        fontFamily: "monospace",
        fontSize: 12
      }
    })
  );
};

const App = () => {
  // important to memoize the editor
  // or else the Slate component is recreated on every edit
  // losing the selection
  const inputEditor = React.useMemo(
    () =>
      SlateHistory.withHistory(
        SlateReact.withReact(withTypes(Slate.createEditor()))
      ),
    []
  );

  const outputEditor = React.useMemo(
    () =>
      SlateHistory.withHistory(
        SlateReact.withReact(withTypes(Slate.createEditor()))
      ),
    []
  );

  const [inputValue, setInputValue] = useLocalStorage(
    "input",
    () => "<editor>\n  <block>this is a line of text</block>\n</editor>"
  );
  const [slateValue, setSlateValue] = useLocalStorage(
    "slate",
    () => { try { return xmlToSlate(inputValue).children } catch (e) { return [ { type: 'block', children: [] } ] } },
    json => JSON.parse(json),
    nodes => JSON.stringify(nodes, undefined, 2)
  );
  const [transformValue, setTransformValue] = useLocalStorage(
    "transform",
    () => "editor.insertText('xyzzy')"
  );

  const setSlateAndInputValue = React.useCallback(nodes => {
    setSlateValue(nodes);
    setInputValue(slateToXml(inputEditor));
  }, []);

  const setInputAndSlateValue = React.useCallback(input => {
    setInputValue(input);
    try {
      setSlateValue(xmlToSlate(input).children);
    } catch (e) {
      // TODO(jaked) report this error somehow?
      // lots of transient errors while editing
      console.log(e);
    }
  }, []);

  let outputXmlValue = undefined;
  let outputSlateValue = undefined;
  try {
    const editor = xmlToSlate(inputValue);

    new Function(`
      return (editor, Editor, Element, Node, Path, Text, Transforms) => {
        ${transformValue}
      }
    `)()(
      editor,
      Slate.Editor,
      Slate.Element,
      Slate.Node,
      Slate.Path,
      Slate.Text,
      Slate.Transforms
    );

    outputXmlValue = slateToXml(editor);
    outputSlateValue = editor.children;
  } catch (e) {
    console.log(e);
    outputXmlValue = e.message;
    outputSlateValue = [];
  }

  return e(
    "div",
    {
      style: {
        backgroundColor: 'aliceblue',
        padding: "10px",
        display: "grid",
        gridTemplateColumns: "max-content 1fr 1fr",
        gridTemplateRows: "max-content 1fr 1fr 1fr",
        gridTemplateAreas: `
          "blank          title       title"
          "inputLabel     slateInput  xmlInput"
          "transformLabel transform   transform"
          "outputLabel    slateOutput xmlOutput"
        `,
        height: "100vh",
        width: "100vw"
      }
    },
    [
      e(Label, { key: "title", gridArea: "title", justifySelf: "center", element: "h1" }, "Slate Explorer"),
      e(Label, { key: "inputLabel", gridArea: "inputLabel" }, "input"),
      e(
        Label,
        { key: "transformLabel", gridArea: "transformLabel" },
        "transform"
      ),
      e(Label, { key: "outputLabel", gridArea: "outputLabel" }, "output"),

      e(SlateEditor, {
        key: "slateInput",
        gridArea: "slateInput",
        editor: inputEditor,
        value: slateValue,
        setValue: setSlateAndInputValue
      }),
      e(CodeEditor, {
        key: "xmlInput",
        gridArea: "xmlInput",
        value: inputValue,
        setValue: setInputAndSlateValue,
        language: Prism.languages.markup
      }),
      e(CodeEditor, {
        key: "transform",
        gridArea: "transform",
        value: transformValue,
        setValue: setTransformValue,
        language: Prism.languages.js
      }),
      e(CodeEditor, {
        key: "xmlOutput",
        gridArea: "xmlOutput",
        value: outputXmlValue,
        setValue: () => {},
        language: Prism.languages.markup
      }),
      e(SlateEditor, {
        key: "slateOutput",
        gridArea: "slateOutput",
        editor: outputEditor,
        value: outputSlateValue,
        setValue: () => {}
      }),
    ]
  );
};

ReactDOM.render(e(App), document.getElementById("app"));
