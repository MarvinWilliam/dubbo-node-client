var dubboClient = require('../index');

//加载配置文件
dubboClient.config(require('./dubbo.config.js'));

////获取serivce
var catQueryProvider = dubboClient.getService('com.weidian.service.UserService', '1.0.0', 'dapengniao');

catQueryProvider.call('find', 'dapengniao')
                .then(function (r) {
                    console.info(r);
                })
                .catch(function (e) {
                    console.error(e);
                });