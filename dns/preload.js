const child_process = require("child_process");
const {
    clipboard
} = require('electron')

const builtinDNSServers = [{
    title: '默认 DNS',
    description: 'empty',
    icon: './icon/icon.png'
}, {
    title: '腾讯 DNSPod',
    description: '119.29.29.29, 119.28.28.28',
    icon: './icon/dnspod.png'
}, {
    title: '阿里 DNS',
    description: '223.5.5.5, 223.6.6.6',
    icon: './icon/alibaba.png'
}, {
    title: '114 DNS',
    description: '114.114.114.114, 114.114.115.115',
    icon: './icon/114.png'
}, {
    title: 'V2EX DNS',
    description: '199.91.73.222, 178.79.131.110',
    icon: './icon/v2ex.png'
}, {
    title: 'Google DNS',
    description: '8.8.8.8, 8.8.4.4',
    icon: './icon/google.png'
}, {
    title: 'OpenDNS',
    description: '208.67.222.222, 208.67.220.220',
    icon: './icon/opendns.png'
}, {
    title: 'Cloudflare DNS',
    description: '1.0.0.1, 1.1.1.1',
    icon: './icon/cloudflare.png'
}]

const showNotification = window.utools.showNotification.bind(window.utools)

// promisify child_process.exec
async function exec(cmd) {
    return new Promise((resolve, reject) => {
        child_process.exec(cmd, (error, stdout, stderr) => {
            if (error) {
                return reject(error)
            }
            resolve([stdout, stderr])
        })
    })
}

async function flushDNS() {
    return await exec('dscacheutil -flushcache')
}

async function getCurrentNetworkDev() {
    const [stdout, stderr] = await exec("netstat -rn | awk '/default/{print $NF}' | head -1")
    return stdout.trim()
}

async function getNetworkService(dev) {
    const [stdout, stderr] = await exec('networksetup -listnetworkserviceorder')
    const service = new RegExp(`\\s(\\S+),.*${dev}\\)`).exec(stdout)[1]
    return service
}

/**
 * get DNS servers for certain network service
 * @param {string} service network service name
 * @returns {string[]}
 */
async function getDNS(service) {
    const [stdout, stderr] = await exec('scutil --dns')
    const matches = stdout.substr(stdout.indexOf('for scoped queries'))
        .split('resolver').filter(x => x.includes(service))[0]
        .matchAll(/nameserver.*:\s*(.*)/g)
    return Array.from(matches, x => x[1])
}

/**
 * set DNS servers for certain network service
 * @param {string} service network service name
 * @param {string[]} servers DNS server list
 */
async function setDNS(service, servers) {
    const cmd = `networksetup -setdnsservers ${service} ` + servers.join(' ')
    await exec(cmd)
}

/**
 * get DNS servers for default network
 * @returns {string[]}
 */
async function getDefaultDNS() {
    return await getDNS(await getCurrentNetworkDev())
}

/**
 * set DNS servers for default network
 * @param {string} servers_str DNS servers in plain text
 */
async function setDefaultDNS(servers_str) {
    const servers = servers_str.split(/[, ]/).map(x => x.trim()).filter(x => x)
    const dev = await getNetworkService(await getCurrentNetworkDev())
    await setDNS(dev, servers)
}

window.exports = {
    "switch-dns": {
        mode: "list", // 列表模式
        args: {
            // 进入执行 可选
            enter: (action, callbackSetList) => {
                if (action.type === 'regex') {
                    window.utools.hideMainWindow()
                    setDefaultDNS(action.payload).then(() => {
                        showNotification(`设置当前 DNS 为 ${action.payload}`)
                    }).catch(showNotification)
                    window.utools.outPlugin()
                    return
                }
                callbackSetList(builtinDNSServers)
            },
            // 子输入框内容变化时被调用 可选 (未设置则无搜索)
            search: (action, searchWord, callbackSetList) => {
                searchWord = searchWord.trim()
                var filteredServers = builtinDNSServers.filter(
                    x => (x.title.includes(searchWord) || x.description.includes(searchWord)))
                // display user input (if exists) as server at top
                if (searchWord) {
                    filteredServers.unshift({
                        title: '自定义',
                        description: searchWord,
                        icon: './icon/icon.png',
                    })
                }
                callbackSetList(filteredServers)
            },
            // 选择执行
            select: (action, itemData) => {
                window.utools.hideMainWindow()
                setDefaultDNS(itemData.description).then(() => {
                    var msg = `切换配置到 ${itemData.title}`
                    if (itemData.description !== 'empty') {
                        msg += `，当前 DNS 为 ${itemData.description}`
                    }
                    showNotification(msg)
                }).catch(showNotification);
                window.utools.outPlugin()
            },
            // 子输入框为空时的占位符 可选，默认为字符串"搜索"
            placeholder: "DNS 服务器"
        }
    },
    "get-dns": {
        mode: "none", // 无UI模式
        args: {
            // 进入执行
            enter: (action) => {
                window.utools.hideMainWindow()
                getDefaultDNS().then((servers) => {
                    const servers_str = servers.join(', ')
                    showNotification(`当前 DNS 为 ${servers_str}`)
                    clipboard.writeText(servers_str)
                }).catch(showNotification)
                window.utools.outPlugin()
            }
        }
    },
    "flush-dns": {
        mode: "none", // 无UI模式
        args: {
            // 进入执行
            enter: (action) => {
                window.utools.hideMainWindow()
                flushDNS().then(() => {
                    showNotification('成功清空 DNS 缓存')
                }).catch(showNotification)
                window.utools.outPlugin()
            }
        }
    },
}