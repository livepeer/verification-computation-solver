# Verification Computation Solver

A Node.js application for monitoring a LivepeerVerifier contract for verification request events.
Upon receiving a request, the application pulls the verification code archive from IPFS, uses Docker to build an image from the archive, runs the Docker application
with parameters from the request event and submits the result of the computation back to the LivepeerVerifier contract.

## Running

```
cd verification-computation-solver
node index.js -a <ACCOUNT_ADDRESS> -c <CONTROLLER_ADDRESS>
```

`<ACCOUNT_ADDRESS>` is the unlocked Ethereum account address to be used by the application. `<CONTROLLER_ADDRESS>` is the address of the Controller contract.
