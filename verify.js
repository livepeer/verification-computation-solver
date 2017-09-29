const Web3Wrapper = require("./lib/web3Wrapper")
const ControllerWrapper = require("./lib/controllerWrapper")
const LivepeerVerifierWrapper = require("./lib/livepeerVerifierWrapper")
const Web3 = require("web3")

const yargsOpts = {
    alias: {
        "controller": ["c"],
        "account": ["a"]
    },
    configuration: {
        "parse-numbers": false
    }
}

const argv = require("yargs-parser")(process.argv.slice(2), yargsOpts)

const provider = new Web3.providers.HttpProvider("http://localhost:8545")

const run = async () => {
    if (argv.controller === undefined) {
        throw new Error("Must pass in the Controller contract address")
    }

    if (argv.account === undefined) {
        throw new Error("Must pass in an unlocked Etheruem account address")
    }

    const web3Wrapper = new Web3Wrapper(provider)
    const controller = new ControllerWrapper(web3Wrapper, argv.controller)
    const verifierAddress = await controller.getVerifierAddress()
    const verifier = new LivepeerVerifierWrapper(web3Wrapper, verifierAddress, argv.account)

    await verifier.verify(0, 0, 0, "P720p60fps16x9,P720p30fps16x9", "QmR9BnJQisvevpCoSVWWKyownN58nydb2zQt9Z2VtnTnKe", ["0xcda2f677da4cdf85364c90a85a8ecfdaa8b5677aeca346efa2a5247654079a29", "0x77903c5de84acf703524da5547df170612ab9308edfec742f5f22f5dc0cfb76a"])
}

run()
