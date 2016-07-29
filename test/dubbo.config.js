module.exports = {
    application: {
        'application': 'dubbo_node_client',
        'application.version': '1.0',
        'category': 'consumer',
        'dubbo': 'dubbo_node_client_1.0',
        'side': 'consumer',
        'pid': process.pid,
        'version': '1.0'
    },
    // dubbo: {
    //     providerTimeout: 3,
    //     weight: 1
    // },
    registry: '192.168.0.102:2181',
    // registryTimeout: 30000,
    // registryDelay: 1000,
    // registryRetry: 0,
    loadbalance: 'random'
};