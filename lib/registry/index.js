var Config = require('../config/index'),
    Cluster = require('../rpc/cluster/index'),
    Zookeeper = require('node-zookeeper-client');
//-----------------------------------------------------------------------------------------------
//
//
//
//
//
//-----------------------------------------------------------------------------------------------
var Registry = function() {
    this.zookeeper = null;
    this.serviceMap = {};
    this.initQueue = [];
};

//-----------------------------------------------------------------------------------------------
// 往zookeeper注册
//-----------------------------------------------------------------------------------------------
Registry.prototype.init = function() {
    var self = this;
    Cluster.init();
    this.isInitializing = true;
    this.zookeeper = Zookeeper.createClient(Config.getRegistryAddress(), Config.getRegistryOption());
    this.zookeeper.once('connected', function() {
        self.initQueue.forEach(function(p) { //从队列中获取, 逐个通知
            p(self.zookeeper);
        });
        self.isInitializing = false;
        console.log('Registry : 已连接上zookeeper');
    });
    this.zookeeper.connect();
};

//-----------------------------------------------------------------------------------------------
// 把invoke注册上来, 当zookeeper刷新
//-----------------------------------------------------------------------------------------------
Registry.prototype.register = function(invokerDesc, invoker) {
    var descStr = invokerDesc.toString(),
        serviceName = invokerDesc.getService();

    //判断是否已经订阅过
    if (!this.serviceMap[descStr]) {
        this.serviceMap[descStr] = invoker;

        //
        this.subscribe(invokerDesc)
            .then(function(client) {
                var registryPath = Config.getRegistryPath(serviceName);
                client.create(registryPath, null, Zookeeper.CreateMode.EPHEMERAL, function(err) {
                    if (err) {
                        console.error('Registry : 注册失败 [' + descStr + '] [' + err.toString() + ']');
                    } else {
                        console.log('Registry : 注册成功 [' + descStr + ']');
                    }
                });
            });
    }
};

//-----------------------------------------------------------------------------------------------
// 获取Invoker
//-----------------------------------------------------------------------------------------------
Registry.prototype.getInvoker = function(invokerDesc) {
    var descStr = invokerDesc.toString();
    return this.serviceMap[descStr];
};

//-----------------------------------------------------------------------------------------------
// 获取zookeeper
//-----------------------------------------------------------------------------------------------
Registry.prototype.getZookeeper = function() {
    var self = this;
    return new Promise(function(resolve, reject) {
        if (self.zookeeper) {
            resolve(self.zookeeper);
        } else if (self.isInitializing) {
            //如果zookeeper正在初始化中, 其他就不要初始化了, 加入队列等待
            self.initQueue.push(resolve);
        }
    });
};

//-----------------------------------------------------------------------------------------------
// 注册之前先订阅信息
//-----------------------------------------------------------------------------------------------
Registry.prototype.subscribe = function(invokerDesc) {
    var self = this,
        desc = invokerDesc.toString(),
        service = invokerDesc.getService(),
        path = Config.getSubscribePath(service);
    return this.getZookeeper()
        .then(function(client) {
            var callee = arguments.callee;
            client.getChildren(path,
                function() {
                    callee(client);
                },
                function(err, children) {
                    if (err) {
                        console.error('Registry : 订阅失败 [' + desc + '] [' + err.toString() + ']');
                    } else if (children.length > 0) {
                        self.onMethodChangeHandler(invokerDesc, children);
                        console.log('Registry : 订阅成功 [' + desc + ']');
                    } else {
                        //console.warn('Registry : 尚未发现服务提供者 [' + desc + ']');
                    }
                });
            return client;
        })
        .then(function(client) {
            self.configurators(invokerDesc);
            return client;
        })
};

//-----------------------------------------------------------------------------------------------
// 更新服务提供的方法
//-----------------------------------------------------------------------------------------------
Registry.prototype.onMethodChangeHandler = function(invokerDesc, children) {
    children.forEach(function(child) {
        child = decodeURIComponent(child);
        var mHost = /^jsonrpc:\/\/([^\/]+)\//.exec(child),
            mVersion = /version=(\d\.\d\.\d)/.exec(child),
            mGroup = /group=([^&]+)/.exec(child),
            mMehtod = /methods=([^&]+)/.exec(child),
            mWeight = /weight=(\d+)/.exec(child);

        //有方法, 并且匹配成功
        if (mHost && mMehtod && invokerDesc.isMatch(mGroup && mGroup[1], mVersion && mVersion[1])) {
            // this.serviceMap[invokerDesc.toString()].setMethod(mMehtod[1].split(','));
            console.info('Registry : 提供者 [' + invokerDesc + '] HOST [' + mHost[1] + ']');
            Cluster.addProvider(invokerDesc, mHost[1]);
            Cluster.setProviderWeight(invokerDesc, mHost[1], mWeight ? ~~mWeight[1] : Config.getDefaultWeight())
        }

    }.bind(this));
    Cluster.refreshProvider(invokerDesc);
};

//-----------------------------------------------------------------------------------------------
// 更新服务提供的权重
//-----------------------------------------------------------------------------------------------
Registry.prototype.configurators = function(invokerDesc) {
    var serviceName = invokerDesc.getService(),
        path = Config.getConfiguratorsPath(serviceName);
    this.getZookeeper()
        .then(function(client) {
            var callee = arguments.callee;
            client.getChildren(path,
                function() {
                    callee(client);
                },
                function(err, children) {
                    if (err) {
                        console.error('Registry : 获取权重失败 [' + serviceName + '] [' + err.toString() + ']');
                    } else if (children.length > 0) {
                        children.forEach(function(child) {
                            child = decodeURIComponent(child);
                            var mHost = /^override:\/\/([^\/]+)\//.exec(child),
                                mVersion = /version=(\d\.\d\.\d)/.exec(child),
                                mGroup = /group=([^&]+)/.exec(child),
                                mDisabled = /disabled=([^&]+)/.exec(child),
                                mEnable = /enabled=([^&]+)/.exec(child),
                                mWeight = /weight=(\d+)/.exec(child);

                            //console.error(mHost[1] + ' ---- ' + (mWeight ? mWeight[1] : 1) + '-----' + (mVersion ?
                            // mVersion[1] : ''));
                            if (((mEnable && mEnable[1] == 'true') || (mDisabled && mDisabled[1] == 'false')) && invokerDesc.isMatch(mGroup && mGroup[1], mVersion && mVersion[1])) { //可用
                                Cluster.setProviderWeight(invokerDesc, mHost[1], mWeight ? ~~mWeight[1] : Config.getDefaultWeight()); //没权重的默认1拉
                            }
                        });
                        console.log('Registry : 获取权重成功 [' + serviceName + '] ');
                    } else {
                        console.warn('Registry : 获取权重失败 [' + serviceName + '] [ 尚未发现服务提供者 ]');
                    }
                });
        });
};

//-----------------------------------------------------------------------------------------------
// 销毁后关闭zookeeper链接
//-----------------------------------------------------------------------------------------------
Registry.prototype.destroy = function() {
    this.zookeeper ? this.zookeeper.close() : function() {};
};

//-----------------------------------------------------------------------------------------------
//
//
//
//
//
//-----------------------------------------------------------------------------------------------
var registry = new Registry();
module.exports = registry;

//-----------------------------------------------------------------------------------------------
// 更新方法
//-----------------------------------------------------------------------------------------------
process.on('SIGINT', registry.destroy);
process.on('exit', registry.destroy);
