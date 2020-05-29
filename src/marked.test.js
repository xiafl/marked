
let marked = require('./marked');

let html = `
## 这是标题
这是内容

## 这是标题1
[参考链接](http://www.baidu.com)



下面是代码


\`\`\`js fileName="src/aaa.js" collpase 
console.log(1111);
console.log(2222);
\`\`\`

`

marked.Renderer

let result = marked(html);




console.log(result);
