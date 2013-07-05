seajs.config({
    'alias': {
        'validator': 'http://a.mysodao.com/module/jquery-validation-1.9.0/jquery.validate.min.js#',
        'dialog': 'http://a.mysodao.com/module/dialog/dist/dialog.js#'
    },
    'map': [
       [ /^(.*\.(?:css|js))(.*)$/i, '$1?t=20130523']
    ]
});
(function () {
    var dev = true, //上线时，修改为false
        scripts = document.scripts,
        script = scripts[scripts.length - 1],
        boot = script.getAttribute('data-init'),
        dir = script.getAttribute('src');
    
    dir = dir.slice(0, dir.lastIndexOf('/') + 1);
    //dev 
    if (dev) {
        if (location.href.indexOf('debug') === -1) {
            seajs.config({
                'map': [
                   [ /^(.*\.(?:css|js))(.*)$/i, '$1?t=' + (+new Date())]
                ]
            });
        }
        dir = dir + 'src/';
    } else {
        dir = dir + 'dist/';
    }

    /*
     * 上面获取路径脚本需要立刻执行
     * 将加载脚本放到domReady后执行，避免ie浏览器终止操作错误
     */
    $(function () {
        if (boot) {
            seajs.use(dir + boot);
        }
    });
})();
