import parseXml from 'https://cdn.skypack.dev/pin/@rgrove/parse-xml@v3.0.0-jMFe7mSMYStpUfnUTz7K/mode=imports/optimized/@rgrove/parse-xml.js';
import XMLWriter from 'https://cdn.skypack.dev/pin/xml-writer@v1.7.0-r8i5k18ngLdXbG8rwkMZ/mode=imports/optimized/xml-writer.js';
import Editor from 'https://cdn.skypack.dev/pin/react-simple-code-editor@v0.11.0-vp8sfAAurbJN9zEtyguq/mode=imports/optimized/react-simple-code-editor.js';
import Prism from 'https://cdn.skypack.dev/pin/prismjs@v1.25.0-tTYTDFL4W8LppUEEfV3w/mode=imports/unoptimized/components/prism-core.js';
import 'https://cdn.skypack.dev/pin/prismjs@v1.25.0-tTYTDFL4W8LppUEEfV3w/mode=imports/unoptimized/components/prism-clike.js';
import 'https://cdn.skypack.dev/pin/prismjs@v1.25.0-tTYTDFL4W8LppUEEfV3w/mode=imports/unoptimized/components/prism-javascript.js';
import 'https://cdn.skypack.dev/pin/prismjs@v1.25.0-tTYTDFL4W8LppUEEfV3w/mode=imports/unoptimized/components/prism-markup.js';
import * as Slate from 'https://cdn.skypack.dev/pin/slate@v0.66.5-O2GwBInMa4eTHXhKxakn/mode=imports/optimized/slate.js';
import * as SlateHistory from 'https://cdn.skypack.dev/pin/slate-history@v0.66.0-Ef1xrdc3SYo0pVfi3q52/mode=imports/optimized/slate-history.js';
import * as SlateHyperscript from 'https://cdn.skypack.dev/pin/slate-hyperscript@v0.66.0-w2pz0tuljkvxbbkEqrdR/mode=imports/optimized/slate-hyperscript.js';
import React from 'https://cdn.skypack.dev/pin/react@v17.0.1-yH0aYV1FOvoIPeKBbHxg/mode=imports/optimized/react.js';
import ReactDOM from 'https://cdn.skypack.dev/pin/react-dom@v17.0.1-oZ1BXZ5opQ1DbTh7nu9r/mode=imports/optimized/react-dom.js';
import { Inspector } from 'https://cdn.skypack.dev/pin/react-inspector@v5.1.1-oNzpdFszRH7WWPG5yu6u/mode=imports/optimized/react-inspector.js';

// can't yet be converted to use Skypack because https://github.com/skypackjs/skypack-cdn/issues/142
window.React = React;
window.Slate = Slate;
import('https://unpkg.com/slate-react@0.66.6/dist/slate-react.js').then(() => {
  ReactDOM.render(e(App), document.getElementById('app'))
});

/* turn off JSHint warnings in Glitch: */
/* globals SlateReact */

const useState = (label, init, fromStorage, toStorage) => {
  let hashValue = undefined;
  if (window.location.hash) {
    try {
      const json = JSON.parse(atob(decodeURIComponent(window.location.hash.substring(1))));
      if (label in json)
        hashValue = json[label];
    } catch (e) { console.log(e) }
  }
  const storageValue = localStorage.getItem(label);
  let initValue;
  if (hashValue !== undefined) {
    initValue = hashValue;
  } else if (storageValue !== null) {
    if (fromStorage) {
      initValue = fromStorage(storageValue);
    } else {
      initValue = storageValue;
    }
  } else {
    initValue = init();
  }
  const [value, setValue] = React.useState(initValue);
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
    block: { type: 'block' },
    inline: { type: 'inline' },
    void: { type: 'void' },
    p: { type: 'p' },
    h1: { type: 'h1' },
    h2: { type: 'h2' },
    h3: { type: 'h3' },
    ul: { type: 'ul' },
    li: { type: 'li' },
  }
});

const withTypes = editor => {
  const { isInline, isVoid } = editor;
  editor.isInline = element => {
    return element.type === 'inline' ? true : isInline(element);
  };
  editor.isVoid = element => {
    return element.type === 'void' ? true : isVoid(element);
  };
  return editor;
};

const xmlToSlate = string => {
  const xmlToSlate = xml => {
    switch (xml.type) {
      case 'document':
        // it's an XML parse error to have != 1 child
        return xmlToSlate(xml.children[0]);
      case 'element':
        return jsx(
          xml.name,
          // xml.attributes has some JS magic that SlateHyperscript.jsx doesn't like
          // copy it to get a plain object
          { ...xml.attributes },
          xml.children
            .map(xmlToSlate)
            // filter out all-whitespace text nodes like JSX
            .filter(node => typeof node != 'string' || /\S/.test(node))
        );
      case 'text':
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
        throw new Error('unexpected XML type');
    }
  };
  const editor = withTypes(xmlToSlate(parseXml(string)));
  Slate.Editor.normalize(editor, { force: true });
  return editor;
};

const slateToXml = editor => {
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
          xw.startElement('cursor').endElement();
        else if (offset === anchorOffset)
          xw.startElement('anchor').endElement();
        else if (offset === focusOffset)
          xw.startElement('focus').endElement();
        else throw new Error('expected anchor or focus');
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

  const xw = new XMLWriter('  ');
  slateToXml(xw, [], editor, editor.selection);
  return xw.toString();
};

const e = React.createElement;

const ScrollBox = ({ children }) => {
  return e(
    'div',
    {
      style: {
        backgroundColor: 'white',
        overflow: 'scroll',
        margin: '5px',
        padding: '5px',
        borderRadius: '10px',
        borderStyle: 'solid',
        borderWidth: '1px',
      }
    },
    children
  );
};

const Label = (props) => {
  const { children, justifySelf = 'end' } = props;
  return e(
    'div',
    {
      style: {
        justifySelf
      }
    },
    e('p', { style: { margin: '5px', fontSize: '24px' } }, children)
  );
};

const Help = (props) => {
  const { children } = props;

  return e(
    ScrollBox,
    { },
    e('div', { dangerouslySetInnerHTML: { __html:`
<h3>Hello!</h3>

<p>Slate Explorer is a tool to help you explore the <a href="https://slatejs.org/">Slate</a> rich-text editor framework and its API. It's made by <a href="https://jaked.org/">Jake Donham</a>. See <a href="https://jaked.org/blog/2021-02-26-Slate-Explorer">here</a> for more background, or <a href="https://github.com/jaked/slate-explorer">here</a> for code.</p>

<h3>Input</h3>

<p>The left-hand input box is a Slate editor. The right-hand input box is the XML representation of the editor model (using <a href="https://docs.slatejs.org/libraries/slate-hyperscript">slate-hyperscript</a>). You can change either input box and your changes will be reflected in the other. (Try changing the selection in the Slate editor and see how it shows up in the XML representation.)</p>

<p>The editor has no UI for setting styles etc. but you can use the following tags in the XML box: <code>block</code>, <code>inline</code>, <code>void</code>, <code>p</code>, <code>h1</code>, <code>h2</code>, <code>h3</code>, <code>ul</code>, <code>li</code>. You can also use <code>text</code> with attributes <code>bold</code> and <code>italic</code>. Finally you can use selection tags: <code>cursor</code>, <code>anchor</code>, <code>focus</code>.</p>

<h3>Transform</h3>

<p>The left-hand transform box accepts JavaScript code that you can use to run Slate API calls against the editor. The following identifiers are bound in the environment: <code>editor</code>, <code>Editor</code>, <code>Element</code>, <code>Node</code>, <code>Path</code>, <code>Range</code>, <code>Text</code>, <code>Transforms</code>. If you return a value from this code, it's shown in an inspector in the right-hand transform box. (Try <code>return editor.selection</code> then change the selection.)</p>

<h3>Output</h3>

<p>The left-hand output box is a read-only Slate editor that shows the result of the transformation; the right-hand output box shows the XML representation.</p>
` } })
  );
}

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
            margin: '2px',
            padding: '2px',
            borderRadius: '5px',
            borderStyle: 'solid',
            borderWidth: '1px'
          }
        },
        children
      );

  case 'void':
    return e(
      'div',
      { ...attributes },
      children
    );

  default:
  }
}

const SlateEditor = ({ editor, value, setValue }) => {
  return e(
    ScrollBox,
    { },
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

const CodeEditor = ({ value, setValue, language }) => {
  const highlight = code => Prism.highlight(code, language);

  return e(
    ScrollBox,
    { },
    e(Editor, {
      value,
      onValueChange: setValue,
      highlight,
      style: {
        fontFamily: 'monospace',
        fontSize: 12
      }
    })
  );
};

const TitleBar = ({ state, showHelpValue, setShowHelpValue }) => {
  const copyLinkRef = React.useRef(null);

  // cribbed from https://nginx-playground.wizardzines.com/script.js
  const copyLink = (e) => {
    e.preventDefault();
    const hash = btoa(JSON.stringify(state));
    window.location.hash = hash;
    // copy url to clipboard
    const url = window.location.href;
    const el = document.createElement('textarea');
    el.value = url;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);

    const span = copyLinkRef.current;
    if (span) {
      span.style.background = 'red';
      span.style.transition = 'background 0s';
      setTimeout(() => {
        span.style.background = 'transparent';
        span.style.transition = 'background 0.5s';
      }, 0);
    }
  }

  const toggleHelp = (e) => {
    e.preventDefault();
    setShowHelpValue(!showHelpValue);
  }

  return e(
    'div',
    {},
    e('p', { style: { margin: '5px' } },
      e(
        'span',
        { style: { fontSize: '36px' } },
        'Slate Explorer'
      ),
      e(
        'span',
        {
          ref: copyLinkRef,
          onClick: copyLink,
          style: {
            cursor: 'pointer',
            fontSize: '24px',
            marginLeft: '25px',
            userSelect: 'none',
            borderRadius: '5px',
            padding: '5px',
          }
        },
        'copy link'
      ),
      e(
        'span',
        {
          onClick: toggleHelp,
          style: {
            cursor: 'pointer',
            fontSize: '24px',
            marginLeft: '25px',
            userSelect: 'none',
          }
        },
        showHelpValue ? 'hide help' : 'show help'
      ),
     )
  );
}

const div = (id, children) =>
      e('div', { id, style: { display: 'grid', overflow: 'hidden', gridArea: id } }, children)

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

  const [inputValue, setInputValue] = useState(
    'input',
    () => '<editor>\n  <block>this is a line of text</block>\n</editor>'
  );
  const [slateValue, setSlateValue] = useState(
    'slate',
    () => { try { return xmlToSlate(inputValue).children } catch (e) { return [ { type: 'block', children: [] } ] } },
    json => JSON.parse(json),
    nodes => JSON.stringify(nodes, undefined, 2)
  );
  const [transformValue, setTransformValue] = useState(
    'transform',
    () => `editor.insertText('xyzzy')`
  );
  const [showHelpValue, setShowHelpValue] = useState(
    'showHelp',
    () => false,
    string => string === 'true',
    boolean => boolean ? 'true' : 'false'
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

  let outputXmlValue = '';
  let outputSlateValue = [];
  let transformResult = undefined;
  try {
    const editor = xmlToSlate(inputValue);

    transformResult = new Function(`
      return (editor, Editor, Element, Node, Path, Range, Text, Transforms) => {
        ${transformValue}
      }
    `)()(
      editor,
      Slate.Editor,
      Slate.Element,
      Slate.Node,
      Slate.Path,
      Slate.Range,
      Slate.Text,
      Slate.Transforms
    );
    
    outputXmlValue = slateToXml(editor);
    outputSlateValue = editor.children;
  } catch (e) {
    console.log(e);
    transformResult = e.message;
  }

  return e(
    'div',
    {
      style: {
        backgroundColor: 'aliceblue',
        padding: '10px',
        display: 'grid',
        gridTemplateColumns: `max-content 1fr 1fr ${showHelpValue ? '2fr' : ''}`,
        gridTemplateRows: `max-content 1fr 1fr 1fr`,
        gridTemplateAreas: `
          ".              titleBar    titleBar        ${showHelpValue ? '.' : ''}"
          "inputLabel     slateInput  xmlInput        ${showHelpValue ? 'help' : ''}"
          "transformLabel transform   transformResult ${showHelpValue ? 'help' : ''}"
          "outputLabel    slateOutput xmlOutput       ${showHelpValue ? 'help' : ''}"
        `,
        height: '100vh',
        width: '100vw'
      }
    },
    [
      div('titleBar',
        e(TitleBar, {
          state: {
            input: inputValue,
            slate: slateValue,
            transform: transformValue,
            showHelp: showHelpValue
          },
          showHelpValue,
          setShowHelpValue
        })
       ),
      div('inputLabel',
        e(Label, {}, 'input')
       ),
      div('transformLabel',
        e(Label, {}, 'transform')
       ),
      div('outputLabel',
        e(Label, {}, 'output')
       ),

      div('slateInput',
        e(SlateEditor, {
          editor: inputEditor,
          value: slateValue,
          setValue: setSlateAndInputValue
        })
       ),
      div('xmlInput',
        e(CodeEditor, {
          value: inputValue,
          setValue: setInputAndSlateValue,
          language: Prism.languages.markup
        })
       ),
      div('transform',
        e(CodeEditor, {
          value: transformValue,
          setValue: setTransformValue,
          language: Prism.languages.js
        })
       ),
      div('transformResult',
        e(ScrollBox, {}, e(Inspector, { data: transformResult }))
       ),
      div('xmlOutput',
        e(CodeEditor, {
          value: outputXmlValue,
          setValue: () => {},
          language: Prism.languages.markup
        })
       ),
      div('slateOutput',
        e(SlateEditor, {
          editor: outputEditor,
          value: outputSlateValue,
          setValue: () => {}
        })
       ),

      showHelpValue && div('help', e(Help))
    ]
  );
};
