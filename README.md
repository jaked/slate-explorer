# Slate Explorer

A tool for exploring and understanding the [Slate](https://docs.slatejs.org/) rich-text editor framework.

* Edit in the **input** boxes: left box is a Slate editor, right box is an editor for the XML representation of the Slate tree
* Transform or inspect the Slate tree in the **transform** box: left box takes arbitrary Javascript code (with the Slate API and `editor` in the environment), right box is an inspector on the `return` value of the code
* See the output editor and XML tree in the **output** boxes

![Slate Explorer screenshot](https://cdn.glitch.com/2b6e46c5-649e-40ac-b9a5-b84fa37615f5%2FScreen%20Shot%202021-07-29%20at%2012.03.17%20PM.png?v=1627585622209)

More context and details [here](https://jaked.org/blog/2021-02-26-Slate-Explorer).

Run from a local clone with `npx http-server .`.
