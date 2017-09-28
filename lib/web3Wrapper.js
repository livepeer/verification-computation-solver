const Web3 = require("web3")
const promisify = require("es6-promisify")

class Web3Wrapper {
    constructor(provider) {
        this.web3 = new Web3()
        this.web3.setProvider(provider)
    }

    async getTransactionReceipt(txHash) {
        const receipt = await promisify(this.web3.eth.getTransactionReceipt)(txHash)
        return receipt
    }

    async getContractInstance(artifact, address) {
        const contractExists = await this.contractExistsAtAddress(address)
        if (!contractExists) {
            throw new Error(`No contract found at address ${address}`)
        }

        const contractInstance = this.web3.eth.contract(artifact.abi).at(address)

        const allFnAbi = artifact.abi.filter(fn => fn.type == "function")
        allFnAbi.forEach(fnAbi => {
            if (fnAbi.constant) {
                const callFn = contractInstance[fnAbi.name].call
                contractInstance[fnAbi.name].callAsync = promisify(callFn, contractInstance)
            } else {
                const estimateGasFn = contractInstance[fnAbi.name].estimateGas
                contractInstance[fnAbi.name].estimateGasAsync = promisify(estimateGasFn, contractInstance)
            }
        })

        return contractInstance
    }

    async contractExistsAtAddress(address) {
        const code = await promisify(this.web3.eth.getCode)(address)
        // Matches 0x followed by 0-40 additional zeros
        const isEmptyCode = /^0x0{0,40}$/i.test(code)

        return !isEmptyCode
    }
}

module.exports = Web3Wrapper
