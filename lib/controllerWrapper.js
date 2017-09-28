const ControllerArtifact = require("../artifacts/Controller.json")
const ethUtil = require("ethereumjs-util")
const ethAbi = require("ethereumjs-abi")

class ControllerWrapper {
    constructor(web3Wrapper, controllerAddress) {
        this.web3Wrapper = web3Wrapper
        this.controllerAddress = controllerAddress
    }

    async getVerifierAddress() {
        const controller = await this.getController()
        const verifierAddress = await controller.getContract(ethUtil.bufferToHex(ethAbi.soliditySHA3(["string"], ["Verifier"])))
        return verifierAddress
    }

    async getController() {
        if (this.instance !== undefined) {
            return this.instance
        }

        this.instance = await this.web3Wrapper.getContractInstance(ControllerArtifact, this.controllerAddress)

        return this.instance
    }
}

module.exports = ControllerWrapper
