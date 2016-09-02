var Config = require('../../config/index'),
    Balance = require('./loadbalance/index'),
    RandomBalance = require('./loadbalance/random'),
    RoundBalance = require('./loadbalance/round'),
    _ = require('underscore');

//-----------------------------------------------------------------------------------------------
//
//
//
//
//
//-----------------------------------------------------------------------------------------------
var Cluster = function() {
    this.providerMap = {};
    this.promiseMap = {};
    this.providerTimeoutMap = {};
};

Cluster.prototype.init = function() {
    function _getLoadBalance(balance) {
        switch (balance.toLowerCase()) {
            case 'random':
                return new RandomBalance();
            case 'round':
                return new RoundBalance();
            default:
                return new Balance();
        }
    }

    this.loadbalance = _getLoadBalance(Config.getLoadBalance());
};

//-----------------------------------------------------------------------------------------------
// 删除provider
//-----------------------------------------------------------------------------------------------
Cluster.prototype.removeProvider = function(invokeDesc, providerHost) {
    var desc = invokeDesc.toString(),
        h = this.promiseMap[desc];
    if (h) {
        var i = _.indexOf(h, providerHost);
        h.slice(i, 1);
    }
    return h;
};

//-----------------------------------------------------------------------------------------------
// 新增provider
//-----------------------------------------------------------------------------------------------
Cluster.prototype.addProvider = function(invokeDesc, providerHost) {
    var desc = invokeDesc.toString(),
        h = this.providerMap[desc] || [];
    h.push(providerHost);
    this.providerMap[desc] = h;
    return h;
};

//-----------------------------------------------------------------------------------------------
// 刷新provider
//-----------------------------------------------------------------------------------------------
Cluster.prototype.refreshProvider = function(invokeDesc) {
    //
    var desc = invokeDesc.toString(),
        h = this.providerMap[desc];

    //
    var list = this.promiseMap[desc];
    if (h && list) {
        //移除超时提示
        delete this.providerTimeoutMap[desc];

        //逐个通知
        this.promiseMap[desc] = [];
        for (var i = 0; i < list.length; i++) {
            list[i](h);
        }
    }
};

//-----------------------------------------------------------------------------------------------
// 获取所有provider
//-----------------------------------------------------------------------------------------------
Cluster.prototype.getAllProvider = function(invokerDesc) {
    var self = this;
    return new Promise(function(resolve, reject) {
        var desc = invokerDesc.toString();
        if (self.providerMap[desc]) {
            resolve(self.providerMap[desc]);
        } else {
            //
            self.promiseMap[desc] = self.promiseMap[desc] || [];
            self.promiseMap[desc].push(resolve);

            //
            var index = self.promiseMap.length - 1;
            self.providerTimeoutMap[desc] = setTimeout(function() {
                reject('获取服务提供者超时 [' + desc + ']');
                self.promiseMap[desc].slice(index, 1);
            }.bind(self), Config.getProviderTimeout());
        }
    });
};

//-----------------------------------------------------------------------------------------------
// 获取provider
//-----------------------------------------------------------------------------------------------
Cluster.prototype.getProvider = function(invokerDesc) {
    return this.getAllProvider(invokerDesc).then(function(ps) {
        if (ps.length <= 1) {
            return ps[0] || '';
        } else {
            return this.loadbalance.getProvider(invokerDesc, ps);
        }
    }.bind(this));
};

//-----------------------------------------------------------------------------------------------
// 设置provider的权重
//-----------------------------------------------------------------------------------------------
Cluster.prototype.setProviderWeight = function(invokerDesc, providerHost, weight) {
    this.loadbalance.setProviderWeight(invokerDesc, providerHost, weight);
};

//-----------------------------------------------------------------------------------------------
//
//
//
//
//
//-----------------------------------------------------------------------------------------------
module.exports = new Cluster();
