const path = require("path")
const Web3Wrapper = require("./lib/web3Wrapper")
const ControllerWrapper = require("./lib/controllerWrapper")
const LivepeerVerifierWrapper = require("./lib/livepeerVerifierWrapper")
const ComputationArchive = require("./lib/computationArchive")
const Web3 = require("web3")
const ethUtil = require("ethereumjs-util")
const ethAbi = require("ethereumjs-abi")
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

        const success = unlock(argv.account, argv.password, web3Wrapper)
        if (!success) {
            abort("Failed to unlock account")
        }
    }

    console.log(`Account ${argv.account} unlocked`)

    const controller = new ControllerWrapper(web3Wrapper, argv.controller)
    const verifierAddress = await controller.getVerifierAddress()
    const verifier = new LivepeerVerifierWrapper(web3Wrapper, verifierAddress, argv.account)

    const archive = new ComputationArchive(ARCHIVE_NAME, ARCHIVE_DIR, LOGS_DIR, DOCKER_IMAGE_NAME)
    const archiveHash = await verifier.getVerificationCodeHash()

    console.log(`Using verification code at IPFS hash ${archiveHash}`)

    await archive.setup(archiveHash)

    console.log("Finished setting up computation archive")

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

const unlock = async (account, password, web3Wrapper) => {
    let success = await web3Wrapper.unlockAccount(account, password)
    if (!success) {
        // Prompt for password if default password fails
        password = prompt("Password: ")

        return await web3Wrapper.unlockAccount(account, password)
    } else {
        return true
    }
}

const watchForVerifyRequests = async (verifier, archive) => {
    const eventSub = await verifier.subscribeToVerifyRequest()

    console.log("Watching for verification request events...")

    eventSub.watch(async (err, event) => {
        console.log(`Received verify request #${event.args.requestId}`)
        console.log(`Job ID: ${event.args.jobId} Claim ID: ${event.args.claimId} Seg #: ${event.args.segmentNumber}`)

        let result
        try {
            result = await processVerifyRequest(event.args.requestId, archive, event.args.transcodingOptions, event.args.dataStorageHash)
        } catch (error) {
            console.error(error)
            return
        }

        const transcoderResultHash = ethUtil.bufferToHex(
            ethAbi.soliditySHA3(["bytes", "bytes"], [ethUtil.toBuffer(event.args.dataHash), ethUtil.toBuffer(event.args.transcodedDataHash)])
        )

        console.log(`Results for verify request #${event.args.requestId}`)
        console.log(`Transcoder result hash: ${transcoderResultHash}`)
        console.log(`Verifier result hash: 0x${result}`)
    })

    return eventSub
}

const processVerifyRequest = async (requestNum, archive, transcodingOptions, dataStorageHash) => {
    await archive.runDockerApp(requestNum, dataStorageHash, transcodingOptions)

    const result = await archive.getDockerAppResult(requestNum)
    return result
}

run().catch(console.log)
