const Web3Wrapper = require("./lib/web3Wrapper")
const ControllerWrapper = require("./lib/controllerWrapper")
const LivepeerVerifierWrapper = require("./lib/livepeerVerifierWrapper")
const ComputationArchive = require("./lib/computationArchive")
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

const ARCHIVE_NAME = "archive.zip"
const ARCHIVE_DIR = "archive"
const DOCKER_IMAGE_NAME = "verification"
const LOG_FILE = "verification.log"

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

    const eventSub = await watchForVerifyRequests(verifier)

    process.on("SIGINT", async () => {
        await eventSub.stopWatching()
        console.log("Stop watching for events and exiting...")
        process.exit()
    })
}

const watchForVerifyRequests = async verifier => {
    const archiveHash = await verifier.getVerificationCodeHash()

    const eventSub = await verifier.subscribeToVerifyRequest()

    console.log("Watching for events...")

    eventSub.watch(async (err, event) => {
        console.log("Received verify request")
        console.log(event)

        const result = await processVerifyRequest(archiveHash, event.args.transcodingOptions, event.args.dataStorageHash)

        // Write result on-chain using invokeCallback
        await verifier.invokeCallback(event.args.requestId, "0x" + result)
    })

    return eventSub
}

const processVerifyRequest = async (archiveHash, transcodingOptions, dataStorageHash) => {
    const archive = new ComputationArchive(ARCHIVE_NAME, ARCHIVE_DIR, DOCKER_IMAGE_NAME, LOG_FILE)

    await archive.getArchive(archiveHash)
    await archive.unzipArchive()
    await archive.buildDockerImage()
    await archive.runDockerApp(dataStorageHash, transcodingOptions)
    await archive.cleanUp()

    const result = await archive.getDockerAppResult()
    return result
}

run()
