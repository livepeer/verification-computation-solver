# Verification Computation Solver

A Node.js application for monitoring a LivepeerVerifier contract for verification request events.
Upon receiving a request, the application pulls the verification code archive from IPFS, uses Docker to build an image from the archive, runs the Docker application
with parameters from the request event and submits the result of the computation back to the LivepeerVerifier contract.

## Requirements

- Node version >= 8.5.0
- [IPFS](https://ipfs.io/) installed

## Running

```
ipfs daemon &
cd verification-computation-solver
node index.js -a <ACCOUNT_ADDRESS> -c <CONTROLLER_ADDRESS>
```

`<ACCOUNT_ADDRESS>` is the Ethereum account address to be used by the application. If you are using TestRPC as a client, you should unlock the account you plan on using when you start TestRPC.
If you are using another Ethereum client such as Geth, you will be prompted for the password to unlock your account. `<CONTROLLER_ADDRESS>` is the address of the Controller contract.
