/**
 * Helpers
 */
const escapeTest = /[&<>"']/;
const escapeReplace = /[&<>"']/g;
const escapeTestNoEncode = /[<>"']|&(?!#?\w+;)/;
const escapeReplaceNoEncode = /[<>"']|&(?!#?\w+;)/g;
const escapeReplacements = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};
const getEscapeReplacement = (ch) => escapeReplacements[ch];
function escape(html, encode) {
  if (encode) {
    if (escapeTest.test(html)) {
      return html.replace(escapeReplace, getEscapeReplacement);
    }
  } else {
    if (escapeTestNoEncode.test(html)) {
      return html.replace(escapeReplaceNoEncode, getEscapeReplacement);
    }
  }

  return html;
}

const unescapeTest = /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig;

/**
 * 
 * @example
 * unescape('&lt'); ==> 'lt'
 * unescape('&quot;') ==> 'quot'
 * unescape('&#39;') ==> "'"
 */
function unescape(html) {
  // explicitly match decimal, hex, and named HTML entities
  return html.replace(unescapeTest, (_, n) => {
    n = n.toLowerCase();
    if (n === 'colon') return ':';
    if (n.charAt(0) === '#') {
      return n.charAt(1) === 'x'
        ? String.fromCharCode(parseInt(n.substring(2), 16))
        : String.fromCharCode(+n.substring(1));
    }
    return '';
  });
}

const caret = /(^|[^\[])\^/g; // 以^开头的字符，非[^ 

/**
 * 修改正则表达式 就是将 正则 regex 当作一个字符串，进行修改，最终得到另一个正则
 * @example
 * 1. edit(/aabb/ig, 'g').replace(/ab/g, '^a^cccb^').getRegex(); ==> /aacccbb/g
 */
function edit(regex, opt) {   
  regex = regex.source || regex;
  opt = opt || '';
  const obj = {
    replace: (name, val) => {
      val = val.source || val;
      val = val.replace(caret, '$1'); // 去掉 ^ 符号的作用
      regex = regex.replace(name, val);
      return obj;
    },
    getRegex: () => {
      return new RegExp(regex, opt);
    }
  };
  return obj;
}

const nonWordAndColonTest = /[^\w:]/g;
const originIndependentUrl = /^$|^[a-z][a-z0-9+.-]*:|^[?#]/i;
function cleanUrl(sanitize, base, href) {
  if (sanitize) {
    let prot;
    try {
      prot = decodeURIComponent(unescape(href))
        .replace(nonWordAndColonTest, '')
        .toLowerCase();
    } catch (e) {
      return null;
    }
    if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0 || prot.indexOf('data:') === 0) {
      return null;
    }
  }
  if (base && !originIndependentUrl.test(href)) {
    href = resolveUrl(base, href);
  }
  try {
    href = encodeURI(href).replace(/%25/g, '%'); // % 会被encodeURI编码为 %25
  } catch (e) {
    return null;
  }
  return href;
}

const baseUrls = {};

/**
 * 正则描述: 如果url中不包含路径部分(没有/)，则满足
 * 符合正则的示例:
 * 1. 'a:'
 * 2. 'a:////ndkiediid.js'
 * 3. 'a:/ndk&=ie()[]?#diid'
 * 4. 'a:ndkiediid'
 * 
 * 不符合正则的示例:
 * 1. ':////ndkiediid'
 * 2. 'a://ndkie/diid'
 */
const justDomain = /^[^:]+:\/*[^/]*$/;


/**
 * 正则描述: 从左侧开始直到遇到的第一个:, 本质上就是提取协议部分
 * 符合正则的情况: 
 * 1. 'http://www.baidu.com/aa/bb/cc.js?uu=uu#kk' ==> 'http:'
 * 2. 'a[]/abc?&.js:;::uundkie/diid' ==> $1='a[]/abc?&.js:'
 */
const protocol = /^([^:]+:)[\s\S]*$/;

/**
 * 正则描述: 将url中的前面不包括路径的部分提取出来
 * 符合正则的情况:
 * 1. 'http://www.baidu.com/aa/bb/cc.js?uu=uu#kk' ==> $1='http://www.baidu.com'
 */
const domain = /^([^:]+:\/*[^/]*)[\s\S]*$/;

/**
 * 将base进行转换，结果base1形式一定是: '' 或 aaa://www.baidu.com/ 或 任意的字符/bb/cc/
 * 如果base1中不包含:
 *    1. 如果href以//开头，或以/开头，直接返回 href
 *    2. 否则返回base1
 * 如果base1中包含:
 *    1. 如果href以//开头，则返回 base1中的协议+href
 *    2. 如果href以/开头，则返回 base1中的非路径部分(域名)+href
 *    3. 否则，返回 base1+href
 * @example
 * 1. resolveUrl('aa:bb:cc', 'kkkk'); ==> 'aa:bb:cc/kkkk'
 * 2. resolveUrl('aa:bb:cc/dd/eee', 'kkkk'); ==> 'aa:bb:cc/dd/kkkk'
 * 2. resolveUrl('aa:bb:cc', '//uu/kk'); ==> 'aa://uu/kk'
 * 2. resolveUrl('aa:bb:cc', '/uu/kk'); ==> 'aa:bb:cc/uu/kk'
 * 2. resolveUrl('aa:bb:cc/dd/eee', '//uu/kk'); ==> 'aa://uu/kk'
 * 2. resolveUrl('aa:bb:cc/dd/eee', '/uu/kk'); ==> 'aa:bb:cc/uu/kk'
 * 2. resolveUrl('dkddid', '/uu/kk'); ==> '/uu/kk'
 * 2. resolveUrl('aaaa/bbbb/ccccc', '/uu/kk'); ==> '/uu/kk'
 */
function resolveUrl(base, href) {
  if (!baseUrls[' ' + base]) {
    // we can ignore everything in base after the last slash of its path component,
    // but we might need to add _that_
    // https://tools.ietf.org/html/rfc3986#section-3
    if (justDomain.test(base)) { // 如果base中不包含路径，则在末尾拼接一个 / 
      baseUrls[' ' + base] = base + '/';
    } else {
      baseUrls[' ' + base] = rtrim(base, '/', true); // 从末尾向前方向依次去掉非/，直到遇到一个/为止
    }
  }
  base = baseUrls[' ' + base]; // base现在的值的形式一定是: '' 或 aaa://www.baidu.com/ 或 任意的字符/bb/cc/
  const relativeBase = base.indexOf(':') === -1;

  if (href.substring(0, 2) === '//') {
    if (relativeBase) { // 如果base中不含有:
      return href;
    }
    return base.replace(protocol, '$1') + href; // 提取出base中的协议部分，拼接到 href 前面
  } else if (href.charAt(0) === '/') {
    if (relativeBase) {
      return href;
    }
    return base.replace(domain, '$1') + href; // 提取出base中的非路径部分，拼接到 href 前面
  } else {
    return base + href;  // 两者直接拼接
  }
}

const noopTest = { exec: function noopTest() {} };

/**
 * 
 * @example
 * 1. merge({}, {a: 3, b: 4}, {e: 5}); ==> {a:3,b:4,e:5}
 */
function merge(obj) {
  let i = 1,
    target,
    key;

  for (; i < arguments.length; i++) {
    target = arguments[i];
    for (key in target) {
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        obj[key] = target[key];
      }
    }
  }

  return obj;
}

/**
 * @example
 * 1. splitCells('aaa | bbb | ccc'); ==> ['aaa', 'bbb', 'ccc']
 * 2. splitCells('aaa | bb\|b | ccc'); ==> ['aaa', 'bb|b', 'ccc']
 * 2. splitCells('aaa | bb\\|b | ccc'); ==> ['aaa', 'bb\', 'b', 'ccc']
 * 2. splitCells('aaa | bb\\|b | ccc'); ==> ['aaa', 'bb\', 'b', 'ccc']
 * 2. splitCells('aaa | bb\\|b | ccc', 2); ==> ['aaa', 'bb\']
 * 2. splitCells('aaa | bb\\|b | ccc', 5); ==> ['aaa', 'bb\', 'b', 'ccc', '']
 */
function splitCells(tableRow, count) {
  // ensure that every cell-delimiting pipe has a space
  // before it to distinguish it from an escaped pipe
  const row = tableRow.replace(/\|/g, (match, offset, str) => {
      let escaped = false,
        curr = offset;
      while (--curr >= 0 && str[curr] === '\\') escaped = !escaped;
      if (escaped) {
        // odd number of slashes means | is escaped
        // so we leave it alone
        return '|';
      } else {
        // add space before unescaped |
        return ' |';
      }
  }),
  cells = row.split(/ \|/);
  let i = 0;

  if (cells.length > count) {
    cells.splice(count);
  } else {
    while (cells.length < count) cells.push('');
  }

  for (; i < cells.length; i++) {
    // leading or trailing whitespace is ignored per the gfm spec
    cells[i] = cells[i].trim().replace(/\\\|/g, '|');
  }
  return cells;
}

/**
 * 
 * @example
 * 1. rtrim('abcddd', 'd'); ==> 'abc'
 * 2. rtrim('abcddd', 'e'); ==> 'abcddd'
 * 3. rtrim('abcddd', 'e', true); ==> ''
 * 4. rtrim('abcddd', 'd', true); ==> 'abcddd'
 */
// Remove trailing 'c's. Equivalent to str.replace(/c*$/, '').
// /c*$/ is vulnerable to REDOS.
// invert: Remove suffix of non-c chars instead. Default falsey.
function rtrim(str, c, invert) {
  const l = str.length;
  if (l === 0) {
    return '';
  }

  // Length of suffix matching the invert condition.
  let suffLen = 0;

  // Step left until we fail to match the invert condition.
  while (suffLen < l) {
    const currChar = str.charAt(l - suffLen - 1);
    if (currChar === c && !invert) {
      suffLen++;
    } else if (currChar !== c && invert) {
      suffLen++;
    } else {
      break;
    }
  }

  return str.substr(0, l - suffLen);
}

/**
 * 
 * @example
 * 1. findClosingBracket('(ab(cd)(ef)gh)bb(bb)', ['(', ')']); ==> 13
 * 1. findClosingBracket('(ab(cd)(ef)gh', ['(', ')']); ==> -1
 * 1. findClosingBracket('((bb(cc', ['(', ')']); ==> -1
 * 1. findClosingBracket('((bb(cc))))))', ['(', ')']); ==> 9
 */
function findClosingBracket(str, b) {
  if (str.indexOf(b[1]) === -1) {
    return -1;
  }
  const l = str.length;
  let level = 0,
    i = 0;
  for (; i < l; i++) {
    if (str[i] === '\\') {
      i++;
    } else if (str[i] === b[0]) {
      level++;
    } else if (str[i] === b[1]) {
      level--;
      if (level < 0) {
        return i;
      }
    }
  }
  return -1;
}

function checkSanitizeDeprecation(opt) {
  if (opt && opt.sanitize && !opt.silent) {
    console.warn('marked(): sanitize and sanitizer parameters are deprecated since version 0.7.0, should not be used and will be removed in the future. Read more here: https://marked.js.org/#/USING_ADVANCED.md#options');
  }
}

module.exports = {
  escape,
  unescape,
  edit,
  cleanUrl,
  resolveUrl,
  noopTest,
  merge,
  splitCells,
  rtrim,
  findClosingBracket,
  checkSanitizeDeprecation
};
