const path = require("path")
const promisify = require("es6-promisify")
const shell = require("shelljs")
const fs = require("fs-extra")
const {ipfsGet} = require("./ipfs")

class ComputationArchive {
    constructor(archiveName, archiveDir, logsDir, imageName) {
        this.archiveName = archiveName
        this.archiveDir = archiveDir
        this.logsDir = logsDir
        this.imageName = imageName
    }

    async setup(archiveHash) {
        // Create log directory if it does not exist
        await fs.ensureDir(this.logsDir)

        // Check if we already have the archive
        if (!(await fs.pathExists(this.archiveDir))) {
            console.log(`Retrieving archive from IPFS using hash ${archiveHash}...`)
            // Get archive from IPFS
            await this.getArchive(archiveHash)

            console.log("Unzipping archive...")
            // Unzip archive
            await this.unzipArchive()
        } else {
            console.log("Already have archive locally")
        }

        console.log("Building docker image using archive...")
        // Build docker image
        await this.buildDockerImage()
    }

    async cleanup() {
        // Delete archive
        if (await fs.pathExists(this.archiveName)) {
            await fs.remove(this.archiveName)
        }

        // Delete archive directory
        if (await fs.pathExists(this.archiveDir)) {
            await fs.remove(this.archiveDir)
        }

        // Remove docker image
        await this.removeDockerImage()
    }

    async removeDockerImage() {
        const cmd = `docker rmi -f ${this.imageName}`
        await promisify(shell.exec)(cmd)
    }

    async getArchive(archiveHash) {
        await ipfsGet(archiveHash, this.archiveName)
    }

    async unzipArchive() {
        await fs.pathExists(this.archiveName)

        const cmd = `unzip -o ${this.archiveName} -d ${this.archiveDir}`
        await promisify(shell.exec)(cmd)
    }

    async buildDockerImage() {
        await fs.pathExists(this.archiveDir)

        const cmd = `docker build -t ${this.imageName} ${this.archiveDir}`

        await promisify(shell.exec)(cmd)
    }

    async runDockerApp(requestNum, dataStorageHash, transcodingOptions) {
        await new Promise((resolve, reject) => {
            const cmd = `docker run -e ARG0=${dataStorageHash} -e ARG1=${transcodingOptions} ${this.imageName}`
            const child = shell.exec(cmd, {async: true})
            child.stdout.pipe(fs.createWriteStream(this.logFile(requestNum)))

            child.stdout.on("end", () => resolve())
            child.stdout.on("error", err => reject(err))
        })
    }

    async getDockerAppResult(requestNum) {
        const cmd = `tail -n 1 ${this.logFile(requestNum)}`
        // Strip trailing new line from result
        const result = (await promisify(shell.exec, {multiArgs: true})(cmd))[0].replace(/\n$/, "")

        if (result.length !== 64) {
            throw new Error("invalid length for result")
        } else {
            return result
        }
    }

    logFile(requestNum) {
        return path.join(this.logsDir, requestNum + ".log")
    }
}

module.exports = ComputationArchive
