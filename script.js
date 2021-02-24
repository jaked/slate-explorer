/* turn off JSHint warnings in Glitch: */
/* globals parseXml, Editor, Prism, React, ReactDOM */
/* globals Slate, SlateReact, SlateHistory, SlateHyperscript, XMLWriter */

const useLocalStorage = (label, init, fromStorage, toStorage) => {
  const storageValue = localStorage.getItem(label);
  const [value, setValue] = React.useState(
    storageValue ?
      (fromStorage ? fromStorage(storageValue) : storageValue) :
      init
  );
  const setLocalValue = React.useCallback(value => {
    localStorage.setItem(label, toStorage ? toStorage(value) : value)
    setValue(value)
  }, [label, setValue]);
  return [value, setLocalValue];
}

const jsx = SlateHyperscript.createHyperscript({
  elements: {
    block: { type: 'block' },
    inline: { type: 'inline' },
    void: { type: 'void' },
  },
});

const withTypes = editor => {
  const { isInline, isVoid } = editor
  editor.isInline = element => {
    return element.type === 'inline' ? true : isInline(element)
  }
  editor.isVoid = element => {
    return element.type === 'void' ? true : isVoid(element)
  }
  return editor
}

const xmlToSlate = (string) => {
  const xmlToSlate = (xml) => {
    switch (xml.type)   {
      case 'document':
        // it's an XML parse error to have != 1 child
        return xmlToSlate(xml.children[0]);
      case 'element':
        return jsx(
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
        return xml.text.trim().replace(/\s+/g, ' ');
      default:
        throw new Error('unexpected XML type');
    }
  }
  const editor = withTypes(xmlToSlate(parseXml(string)));
  Slate.Editor.normalize(editor, { force: true });
  return editor;
}

const slateToXml = (editor) => {
  const slateToXml = (xw, path, node, selection) => {
    if (Slate.Editor.isEditor(node)) {
      xw.startElement('editor');
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
      })
      node.children.forEach((child, i) => {
        slateToXml(xw, path.concat(i), child, selection);
      });
      xw.endElement();
    } else if (Slate.Text.isText(node)) {
      if (selection) {
        // compute list of offsets where we need to insert a selection tag
        let { anchor, focus } = selection;
        let anchorOffset = null;
        let focusOffset = null;
        if (Slate.Path.equals(path, anchor.path))
          anchorOffset = anchor.offset;
        if (Slate.Path.equals(path, focus.path))
          focusOffset = focus.offset;
        // filter out nulls and duplicates
        let offsets = [ anchorOffset, focusOffset ]
          .filter((offset, index, self) => offset !== null && self.indexOf(offset) === index)
        offsets.sort();

        let lastOffset = 0;
        for (const offset of offsets) {
          if (offset > lastOffset) {
            xw.text(node.text.substring(lastOffset, offset));
            lastOffset = offset;
          }
          xw.indent = false;
          if (offset === anchorOffset && offset === focusOffset)
            xw.startElement('cursor').endElement();
          else if (offset === anchorOffset)
            xw.startElement('anchor').endElement();
          else if (offset === focusOffset)
            xw.startElement('focus').endElement();
          else throw new Error('expected anchor or focus');
          xw.indent = true;
        }
        if (lastOffset < node.text.length)
          xw.text(node.text.substring(lastOffset));
      } else {
        xw.text(node.text);
      }
    } else
      throw new Error(`expected Slate node type ${node}`)
  }

  const xw = new XMLWriter('  ');
  slateToXml(xw, [], editor, editor.selection);
  return xw.toString();
}

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
        {},
      )
    )
  );
}

const CodeEditor = ({ gridArea, value, setValue, language }) => {
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

const App = () => {
  // important to memoize the editor
  // or else the Slate component is recreated on every edit
  // losing the selection
  const editor = React.useMemo(
    () => SlateHistory.withHistory(SlateReact.withReact(withTypes(Slate.createEditor()))),
    []
  );
  
  const [slateValue, setSlateValue] =
    useLocalStorage(
      'slate',
      [ { type: 'block', children: [ { text: 'this is a line of text' } ] } ],
      json => JSON.parse(json),
      nodes => JSON.stringify(nodes, undefined, 2)
    );
  const [inputValue, setInputValue] =
    useLocalStorage(
      'input',
      "<editor>\n  <block>this is a line of text</block>\n</editor>"
    );
  const [transformValue, setTransformValue] =
    useLocalStorage(
      'transform',
      "editor.insertText('xyzzy')"
  );

  const setSlateAndInputValue = React.useCallback(nodes => {
    setSlateValue(nodes);
    setInputValue(slateToXml(editor));
  }, []);

  const setInputAndSlateValue = React.useCallback(input => {
    setInputValue(input);
    try {
      const editor2 = xmlToSlate(input);
      // editor.selection = editor2.selection;
      setSlateValue(editor2.children);
    } catch (e) {
      // TODO(jaked) report this error somehow?
      // lots of transient errors while editing
      console.log(e);
    }
  }, []);
  
  let outputValue = undefined;
  try {
    const editor = xmlToSlate(inputValue);

    (new Function(`
      return (editor, Editor, Element, Node, Path, Transforms) => {
        ${transformValue}
      }
    `))()(editor, Slate.Editor, Slate.Element, Slate.Node, Slate.Path, Slate.Transforms);

    outputValue = slateToXml(editor);
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

      e(
        SlateEditor,
        {
          key: 'slate',
          gridArea: 'slate',
          editor,
          value: slateValue,
          setValue: setSlateAndInputValue
        }
      ),
      e(
        CodeEditor,
        {
          key: 'input',
          gridArea: 'input',
          value: inputValue,
          setValue: setInputAndSlateValue,
          language: Prism.languages.markup
        }
      ),
      e(
        CodeEditor,
        {
          key: 'transform',
          gridArea: 'transform',
          value: transformValue,
          setValue: setTransformValue,
          language: Prism.languages.js
        }
      ),
      e(
        CodeEditor,
        {
          key: 'output',
          gridArea: 'output',
          value: outputValue,
          setValue: () => {},
          language: Prism.languages.markup
        }
      ),
    ]
  )
}

ReactDOM.render(e(App), document.getElementById("app"));
