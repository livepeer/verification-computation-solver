const ipfsAPI = require("ipfs-api")
const fs = require("fs")

const ipfsGet = (hash, fileName) => {
    const ipfs = ipfsAPI("/ip4/127.0.0.1/tcp/5001")

    return ipfs.files.get(hash).then(stream => {
        return new Promise((resolve, reject) => {
            stream.on("data", file => {
                if (file.path !== hash) {
                    reject(new Error("Incorrect IPFS hash"))
                } else {
                    file.content.pipe(fs.createWriteStream(fileName))
                    file.content.on("end", () => resolve(hash))
                }
            })
        })
    })
}

module.exports = {
    ipfsGet
}
