

const helpers = require('./helpers');
const { resolveUrl }  = helpers;


let arr = [
    // resolveUrl( 'aa:bb:cc', 'kkkk' ),
    resolveUrl( 'aaaa/bbbb/ccccc', '/uu/kk' ),
    // resolveUrl('aaa', 'www.baidu.com'),
]

arr.forEach(result =>{
    console.log(result);
});
