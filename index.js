const path = require("path")
const Web3Wrapper = require("./lib/web3Wrapper")
const ControllerWrapper = require("./lib/controllerWrapper")
const LivepeerVerifierWrapper = require("./lib/livepeerVerifierWrapper")
const ComputationArchive = require("./lib/computationArchive")
const Web3 = require("web3")
const prompt = require("prompt-sync")()

const yargsOpts = {
    alias: {
        "controller": ["c"],
        "account": ["a"],
        "password": ["p"]
    },
    configuration: {
        "parse-numbers": false
    }
}

const argv = require("yargs-parser")(process.argv.slice(2), yargsOpts)

const provider = new Web3.providers.HttpProvider("http://localhost:8545")

const ARCHIVE_NAME = path.resolve(__dirname, "archive.zip")
const ARCHIVE_DIR = path.resolve(__dirname, "archive")
const LOGS_DIR = path.resolve(__dirname, "logs")
const DOCKER_IMAGE_NAME = "verifier"

const run = async () => {
    if (argv.controller === undefined) {
        abort("Must pass in the Controller contract address")
    }

    if (argv.account === undefined) {
        abort("Must pass in a valid Ethereum account address")
    }

    const web3Wrapper = new Web3Wrapper(provider)
    const nodeType = await web3Wrapper.getNodeType()

    if (!nodeType.match(/TestRPC/i)) {
        // Not connected to TestRPC
        // User must unlock account
        const password = ensurePassword()

        const success = await web3Wrapper.unlockAccount(argv.account, password)
        if (!success) {
            abort("Failed to unlock account")
        }
    }

    const controller = new ControllerWrapper(web3Wrapper, argv.controller)
    const verifierAddress = await controller.getVerifierAddress()
    const verifier = new LivepeerVerifierWrapper(web3Wrapper, verifierAddress, argv.account)

    const archive = new ComputationArchive(ARCHIVE_NAME, ARCHIVE_DIR, LOGS_DIR, DOCKER_IMAGE_NAME)
    const archiveHash = await verifier.getVerificationCodeHash()
    await archive.setup(archiveHash)

    const eventSub = await watchForVerifyRequests(verifier, archive)

    process.on("SIGINT", async () => {
        try {
            await eventSub.stopWatching()
            await archive.cleanup()
        } catch (error) {
            console.error(error)
        }

        console.log("Stop watching for events and exiting...")
        process.exit(0)
    })
}

const abort = msg => {
    console.log(msg || "Error occured")
    process.exit(1)
}

const ensurePassword = () => {
    if (argv.password) {
        return argv.password
    } else {
        return prompt("Password: ")
    }
}

const watchForVerifyRequests = async (verifier, archive) => {
    const eventSub = await verifier.subscribeToVerifyRequest()

    console.log("Watching for events...")

    let requestNum = 0

    eventSub.watch(async (err, event) => {
        console.log("Received verify request # " + requestNum)
        requestNum++

        console.log(event)

        let result
        try {
            result = await processVerifyRequest(requestNum, archive, event.args.transcodingOptions, event.args.dataStorageHash)
        } catch (error) {
            console.error(error)
            return
        }

        // Write result on-chain using invokeCallback
        const receipt = await verifier.invokeCallback(event.args.requestId, "0x" + result)
        console.log(receipt)
    })

    return eventSub
}

const processVerifyRequest = async (requestNum, archive, transcodingOptions, dataStorageHash) => {
    await archive.runDockerApp(requestNum, dataStorageHash, transcodingOptions)

    const result = await archive.getDockerAppResult(requestNum)
    return result
}

run().catch(console.log)
