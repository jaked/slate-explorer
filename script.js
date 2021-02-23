/* turn off JSHint warnings in Glitch: */
/* globals parseXml, Editor, Prism, React, ReactDOM, Slate, SlateReact, SlateHyperscript, XMLWriter */

const e = React.createElement

const ScrollBox = ({ gridArea, children }) => {
  return e(
    'div',
    {
      style: {
        gridArea,
        overflow: 'scroll',
        margin: '5px',
        padding: '5px',
        borderRadius: '10px',
        borderStyle: 'solid',
        borderWidth: '1px',
      }
    },
    children
  )
}

const Label = ({ gridArea, children }) => {
  return e(
    'div',
    {
      style: {
        gridArea,
        justifySelf: 'end',
      }
    },
    e('h3', {}, children)
  );
}

const SlateEditor = ({ gridArea, value, setValue }) =>
  e(
    ScrollBox,
    {
      gridArea
    },
    
  )

const HighlightedEditor = ({ gridArea, value, setValue, language }) => {
  const highlight = code => Prism.highlight(code, language)

  return e(
    ScrollBox,
    {
      gridArea
    },
    e(
      Editor,
      {
        value,
        onValueChange: setValue,
        highlight,
        style: {
          fontFamily: 'monospace',
          fontSize: 12,
        }
      }
    )
  );
}

const useLocalStorage = (label, init) => {
  const [value, setValue] = React.useState(localStorage.getItem(label) ?? init);
  const setLocalValue = React.useCallback(value => {
    localStorage.setItem(label, value)
    setValue(value)
  }, [label, setValue]);
  return [value, setLocalValue];
}

const xmlToSlate = (xml) => {
  switch (xml.type)   {
    case 'document':
      // it's an XML parse error to have != 1 child
      return xmlToSlate(xml.children[0]);
    case 'element':
      return SlateHyperscript.jsx(
        xml.name,
        // xml.attributes has some JS magic that SlateHyperscript.jsx doesn't like
        // copy it to get a plain object
        {...xml.attributes},
        xml.children.map(xmlToSlate)
          // filter out all-whitespace text nodes like JSX
          .filter(node => (typeof node != 'string') || /\S/.test(node))
      );
    case 'text':
      // trim string and collapse whitespace like JSX
      return xml.text.trim().replace(/s+/g, ' ');
    default:
      throw new Error('unexpected XML type');
  }
}

// TODO(jaked) put selection in the right place
const slateToXml = (xw, path, node, selection) => {
  if (Slate.Editor.isEditor(node)) {
    xw.startElement('editor');
    node.children.forEach((child, i) => {
      slateToXml(xw, path.concat(i), child, selection);
    });
    xw.endElement();
  } else if (Slate.Element.isElement(node)) {
    xw.startElement('element');
    node.children.forEach((child, i) => {
      slateToXml(xw, path.concat(i), child, selection);
    });
    xw.endElement();
  } else if (Slate.Text.isText(node)) {
    xw.text(node.text);
  } else
    throw new Error('expected Slate node type')
}

const App = () => {
  const [inputValue, setInputValue] = useLocalStorage('input', '<editor />');
  const [transformValue, setTransformValue] = useLocalStorage('transform', 'Transforms.liftNodes(editor)');

  let outputValue = undefined;
  try {
    const xml = parseXml(inputValue);
    const editor = xmlToSlate(xml);

    (new Function(`
      return (editor, Editor, Element, Node, Path, Transforms) => {
        ${transformValue}
      }
    `))()(editor, Slate.Editor, Slate.Element, Slate.Node, Slate.Path, Slate.Transforms);

    const xw = new XMLWriter('  ');
    slateToXml(xw, [], editor, editor.selection);
    outputValue = xw.toString();
  } catch (e) {
    console.log(e);
    outputValue = e.message;
  }
  
  return e(
    'div',
    {
      style: {
        padding: '10px',
        display: 'grid',
        gridTemplateColumns: 'max-content 1fr',
        gridTemplateRows: '1fr 1fr 1fr 1fr',
        gridTemplateAreas: `
          "slateLabel slate"
          "inputLabel input"
          "transformLabel transform"
          "outputLabel output"
        `,
        height: '100vh',
        width: '100vw',
      }
    },
    [
      e(Label, { key: 'slateLabel', gridArea: 'slateLabel' }, 'slate'),
      e(Label, { key: 'inputLabel', gridArea: 'inputLabel' }, 'input'),
      e(Label, { key: 'transformLabel', gridArea: 'transformLabel' }, 'transform'),
      e(Label, { key: 'outputLabel', gridArea: 'outputLabel' }, 'output'),

      e(SlateEditor, { key: 'slate', gridArea: 'slate', value: inputValue, setValue: setInputValue }),
      e(HighlightedEditor, { key: 'input', gridArea: 'input', value: inputValue, setValue: setInputValue, language: Prism.languages.markup }),
      e(HighlightedEditor, { key: 'transform', gridArea: 'transform', value: transformValue, setValue: setTransformValue, language: Prism.languages.js }),
      e(HighlightedEditor, { key: 'output', gridArea: 'output', value: outputValue, setValue: () => {}, language: Prism.languages.markup }),
    ]
  )
}

ReactDOM.render(e(App), document.getElementById("app"));
