import { fromPrecision, toPrecision } from "./numberUtil";
// @ts-ignore
import benchmarkContract from "./contracts/BenchMark.json";
import Web3 from "web3";
import { Synchronization } from "Synchronization";

class BlockChainInteractor {
    web3;
    constructor(web3) {
        this.web3 = web3;
    }
    async executewithGas(method, from, call = true) {
        let gasestimate = await method.estimateGas({ from });
        let gasprice = await this.web3.eth.getGasPrice();
        let round = (a) => a.toFixed(0);
        if (!call) {
            let send = await method.send({ from, gas: round(gasestimate * 1.5), gasPrice: round(+gasprice * 1.105) });
            return send;
        }
        return await method.call({ from, gas: round(gasestimate * 1.5), gasPrice: round(+gasprice * 1.1) });
    }

    toWeirdString(str) {
        return Web3.utils.padLeft(Web3.utils.toHex(str), 64)
    }

    async getAccounts() {
        let [account] = await this.web3.eth.getAccounts();
        return account;
    }
}

export class BenchmarkFactory extends BlockChainInteractor {
    async provision(benchmarkName, lowerBound, upperBound, benchmarkUnit, desc) {
        if (!benchmarkName || !lowerBound || !upperBound || !benchmarkUnit || !desc) {
            throw new Error("Required parameters missing")
        }
        const BenchMark = new this.web3.eth.Contract(benchmarkContract.abi);
        let deployerFn = await BenchMark.deploy({
            data: benchmarkContract.bytecode,
            arguments: [this.toWeirdString(benchmarkName), this.web3.utils.toHex(lowerBound), this.web3.utils.toHex(upperBound), this.toWeirdString(benchmarkUnit), this.toWeirdString(desc)],
        });
        const account = await this.getAccounts();
        let returnValue = await this.executewithGas(deployerFn, account, false);
        return new BenchmarkClient(this.web3, returnValue._address);
    }
}

export class BenchmarkClient extends BlockChainInteractor {
    BenchMarkInstance = null;
    address = null;
    constructor(provider, address) {
        super(provider);
        this.BenchMarkInstance = new this.web3.eth.Contract(benchmarkContract.abi, address);
        this.address = address
    }
    async getDetails() {
        const sync = new Synchronization();
        const storageItem = sync.getItem(this.address)

        if (!storageItem || storageItem.refresh) {
            const account = await this.getAccounts();
            const result = await this.executewithGas(this.BenchMarkInstance.methods.benchmark(), account);
            let response = { name: null, description: null, entries: null, sum: null, upper_bound: null, lower_bound: null, unit: null, address: null };
            response.name = this.web3.utils.hexToUtf8(result.name);
            response.description = this.web3.utils.hexToUtf8(result.description)
            //@ts-ignore
            response.entries = +result.entries.toString();
            //@ts-ignore
            response.sum = fromPrecision(result.sum);
            //@ts-ignore
            response.upper_bound = fromPrecision(result.upper_bound.toString());
            //@ts-ignore
            response.lower_bound = fromPrecision(result.lower_bound.toString());
            response.unit = this.web3.utils.hexToUtf8(result.unit);
            response.address = this.BenchMarkInstance._address;

            if (storageItem && storageItem.refresh === true) {
                sync.updateItem(response)
            } else {
                sync.addItem(response)
            }


            return response;
        } else {
            return storageItem;
        }



    }

    async participate(value) {
        const sync = new Synchronization();
        const account = await this.getAccounts();
        const response =  await this.executewithGas(this.BenchMarkInstance.methods.participate(this.web3.utils.toHex(toPrecision(value))), account, false);
        sync.updateItem({contribution: value, address: this.address})
        return response;
    }

    async getResults(contribution) {
        console.log(contribution)
        const account = await this.getAccounts();
        let best = await this.executewithGas(this.BenchMarkInstance.methods.bestRating(contribution), account);
        let average = await this.executewithGas(this.BenchMarkInstance.methods.average(), account);
        let averageRated = await this.executewithGas(this.BenchMarkInstance.methods.averageRating(contribution), account);
        return { best, average: fromPrecision(average), averageRated };
        
    }

    static decodeErrorMessage(e){
        if (e.message.includes("Internal JSON-RPC")) {

            if (e.message.includes("VM Exception while processing transaction: revert")) {
                let a = e.message.replace("VM Exception while processing transaction: revert", "Smart Contract Fehler:")
                let msg = JSON.parse(a.substring(25)).message
                return msg;
            } else {
                let msg = JSON.parse(e.message.substring(25)).message
                return msg;
            }

        }else{
            return e.message;
        }
    }
}