const promisify = require("es6-promisify")
const shell = require("shelljs")
const fs = require("fs-extra")
const {ipfsGet} = require("./ipfs")

class ComputationArchive {
    constructor(archiveName, archiveDir, imageName, logFile) {
        this.archiveName = archiveName
        this.archiveDir = archiveDir
        this.imageName = imageName
        this.logFile = logFile
    }

    async getArchive(archiveHash) {
        await ipfsGet(archiveHash, this.archiveName)
    }

    async unzipArchive() {
        await fs.pathExists(this.archiveName)

        const cmd = `unzip ${this.archiveName} -d ${this.archiveDir}`
        await promisify(shell.exec)(cmd)
    }

    async buildDockerImage() {
        await fs.pathExists(this.archiveDir)

        const cmd = `docker build -t ${this.imageName} ${this.archiveDir}`
        await promisify(shell.exec)(cmd)
    }

    async runDockerApp(dataStorageHash, transcodingOptions) {
        await new Promise((resolve, reject) => {
            const cmd = `docker run -e ARG0=${dataStorageHash} -e ARG1=${transcodingOptions} ${this.imageName}`
            const child = shell.exec(cmd, {async: true})
            child.stdout.pipe(fs.createWriteStream(this.logFile))

            child.stdout.on("end", () => resolve())
            child.stdout.on("error", err => reject(err))
        })
    }

    async getDockerAppResult() {
        const cmd = `tail -n 1 ${this.logFile}`
        const result = await promisify(shell.exec, {multiArgs: true})(cmd)
        // Strip trailing new line from result
        return result[0].replace(/\n$/, "")
    }

    async removeDockerImage() {
        const cmd = `docker rmi -f ${this.imageName}`
        await promisify(shell.exec)(cmd)
    }

    async cleanUp() {
        // Delete archive
        await fs.pathExists(this.archiveName)
        await fs.remove(this.archiveName)
        // Delete archive directory
        await fs.pathExists(this.archiveDir)
        await fs.remove(this.archiveDir)
        // Remove Docker image
        await this.removeDockerImage()
    }
}

module.exports = ComputationArchive
