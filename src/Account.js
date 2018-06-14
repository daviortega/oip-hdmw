import bitcoin from 'bitcoinjs-lib'
import bip32 from 'bip32'
import bip32utils from 'bip32-utils'

import Address from './Address'
import { toBase58, isValidPublicAddress, discovery } from './util'

// Helper CONSTS (used in other consts)
const SECOND = 1000;
const MINUTE = 60 * SECOND;

// Class Constants
const CHAIN_EXPIRE_TIMEOUT = 30 * MINUTE;
const GAP_LIMIT = 20;

const CUSTOM_ADDRESS_FUNCTION = (node, network) => {
	return { address: node, network: network }
}

/**
 * A BIP32 Node that manages Derivation of Chains and Addresses. This is created from the [`bip32` npm package managed by `bitcoinjs`](https://github.com/bitcoinjs/bip32).
 * @typedef {Object} bip32
 * @example <caption>Spawn a Bitcoin bip32 Node</caption>
 * import bip32 from 'bip32';
 * 
 * var bip32Node = bip32.fromBase58("xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb")
 * @example <caption>Spawn a Flo bip32 Node</caption>
 * import bip32 from 'bip32';
 * import { Networks } from 'oip-hdmw';
 * 
 * var bip32Node = bip32.fromBase58("Fprv4xQSjQhWzrCVzvgkjam897LUV1AfxMuG8FBz5ouGAcbyiVcDYmqh7R2Fi22wjA56GQdmoU1AzfxsEmVnc5RfjGrWmAiqvfzmj4cCL3fJiiC", Networks.flo.network)
 */

/**
 * A BIP32 Chain manager. This is created from the [`bip32-utils` npm package managed by `bitcoinjs`](https://github.com/bitcoinjs/bip32-utils).
 * @typedef {Object} bip32utilschain
 * @example
 * import bip32 from 'bip32';
 * import bip32utils from 'bip32-utils';
 * 
 * var bip32Node = bip32.fromBase58("xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb")
 * var chain = new bip32utils.Chain(bip32Node)
 */

/**
 * Manages Chains and Addresses for a specific BIP32/BIP44 Account
 */
class Account {
	/**
	 * Create a new Account to manage Chains and Addresses for based on a BIP32 Node
	 *
	 * ##### Examples
	 * Create a Bitcoin Account
	 * ```
	 * import { Account, Networks } from 'oip-hdmw';
	 *
	 * var account_master = bip32.fromBase58("xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb")
	 *
	 * var account = new Account(account_master, Networks.bitcoin);
	 * ```
	 * Create a Flo Account
	 * ```
	 * import { Account, Networks } from 'oip-hdmw';
	 *
	 * var account_master = bip32.fromBase58("Fprv4xQSjQhWzrCVzvgkjam897LUV1AfxMuG8FBz5ouGAcbyiVcDYmqh7R2Fi22wjA56GQdmoU1AzfxsEmVnc5RfjGrWmAiqvfzmj4cCL3fJiiC", Networks.flo.network)
	 *
	 * var account = new Account(account_master, Networks.flo);
	 * ```
	 * @param  {bip32} account_master - The BIP32 Node to derive Chains and Addresses from.
	 * @param  {CoinInfo} coin - The CoinInfo for the Account
	 * @param  {boolean} [discover=true] - Should the Account auto-discover Chains and Addresses
	 * @return {Account}
	 */
	constructor(account_master, coin, discover){
		this.account_master = account_master;
		this.coin = coin || {};

		var external = this.account_master.derive(0)
		var internal = this.account_master.derive(1)

		this.account = new bip32utils.Account([
			new bip32utils.Chain(external, undefined, CUSTOM_ADDRESS_FUNCTION),
			new bip32utils.Chain(internal, undefined, CUSTOM_ADDRESS_FUNCTION)
		])

		this.addresses = {}

		this.discovery = {
			0: {
				index: 0,
				lastUpdate: 0
			},
			1: {
				index: 1,
				lastUpdate: 0
			}
		}

		// Discover both External and Internal chains
		if (discover){
			this.discoverChain(0)
			this.discoverChain(1)
		}
	}
	/**
	 * Get the Main Address for a specified Chain and Index on the Chain.
	 * @param  {number}	[chain_number=0] - Number of the specific chain you want to get the Main Address for
	 * @param  {number} [main_address_number=0] - Index of the Main Address on the specified chain
	 * @example
	 * import bip32 from 'bip32'
	 * import { Account, Networks } from 'oip-hdmw'
	 * 
	 * var account_master = bip32.fromBase58("Fprv4xQSjQhWzrCVzvgkjam897LUV1AfxMuG8FBz5ouGAcbyiVcDYmqh7R2Fi22wjA56GQdmoU1AzfxsEmVnc5RfjGrWmAiqvfzmj4cCL3fJiiC", Networks.flo.network)
	 *
	 * var account = new Account(account_master, Networks.flo, false);
	 * var address = account.getMainAddress()
	 * // address.getPublicAddress() = FPznv9i9iHX5vt4VMbH9x2LgUcrjtSn4cW
	 * @return {Address}
	 */
	getMainAddress(chain_number, main_address_number){
		return this.getAddress(chain_number, main_address_number)
	}
	/**
	 * Get the Address for a specified Chain and Index on the Chain.
	 * @param  {number}	[chain_number=0] - Number of the specific chain you want to get the Address from
	 * @param  {number} [address_number=0] - Index of the Address on the specified chain
	 * @example <caption>Get the address on Chain `0` at Index `10`</caption>
	 * import bip32 from 'bip32'
	 * import { Account, Networks } from 'oip-hdmw'
	 * 
	 * var account_master = bip32.fromBase58("Fprv4xQSjQhWzrCVzvgkjam897LUV1AfxMuG8FBz5ouGAcbyiVcDYmqh7R2Fi22wjA56GQdmoU1AzfxsEmVnc5RfjGrWmAiqvfzmj4cCL3fJiiC", Networks.flo.network)
	 *
	 * var account = new Account(account_master, Networks.flo, false);
	 * var address = account.getAddress(0, 10)
	 * // address.getPublicAddress() = F8P6nUvDfcHikqdUnoQaGPBVxoMcUSpGDp
	 * @return {Address}
	 */
	getAddress(chain_number, address_number){
		var addr = CUSTOM_ADDRESS_FUNCTION(this.account.getChain(chain_number || 0).__parent.derive(address_number || 0), this.coin.network);
		
		return new Address(addr, this.coin, false)
	}
	/**
	 * Get the Balance for the entire Account
	 * @example
	 * import bip32 from 'bip32'
	 * import { Account, Networks } from 'oip-hdmw'
	 * 
	 * var account_master = bip32.fromBase58("Fprv4xQSjQhWzrCVzvgkjam897LUV1AfxMuG8FBz5ouGAcbyiVcDYmqh7R2Fi22wjA56GQdmoU1AzfxsEmVnc5RfjGrWmAiqvfzmj4cCL3fJiiC", Networks.flo.network)
	 *
	 * var account = new Account(account_master, Networks.flo, false);
	 * account.getBalance().then((balance) => {
	 * 	console.log(balance);
	 * })
	 * @return {Promise<number>} - Returns a Promise that will resolve to the total balance.
	 */
	getBalance(){
		return new Promise((resolve, reject) => {
			return this.discoverChainsIfNeeded().then(() => {
				var totBal = 0;

				for (var addr in this.addresses){
					totBal += this.addresses[addr].getBalance()
				}

				resolve(totBal)
			})
		})
	}
	/**
	 * Get the Next Chain Address for a specified chain
	 * @param  {number} [chain_number=0] - The specific chain that you want to get the next address from
	 * @example <caption>Get the next Chain Address on Chain #1</caption>
	 * import bip32 from 'bip32'
	 * import { Account, Networks } from 'oip-hdmw'
	 * 
	 * var account_master = bip32.fromBase58("Fprv4xQSjQhWzrCVzvgkjam897LUV1AfxMuG8FBz5ouGAcbyiVcDYmqh7R2Fi22wjA56GQdmoU1AzfxsEmVnc5RfjGrWmAiqvfzmj4cCL3fJiiC", Networks.flo.network)
	 *
	 * var account = new Account(account_master, Networks.flo, false);
	 * var address = account.getNextChainAddress(1)
	 * @return {Address}
	 */
	getNextChainAddress(chain_number){
		return new Address(this.account.getChain(chain_number || 0).next(), this.coin, false);
	}
	/**
	 * Get the Next Change Address from the "Internal" chain
	 * @example
	 * import bip32 from 'bip32'
	 * import { Account, Networks } from 'oip-hdmw'
	 * 
	 * var account_master = bip32.fromBase58("Fprv4xQSjQhWzrCVzvgkjam897LUV1AfxMuG8FBz5ouGAcbyiVcDYmqh7R2Fi22wjA56GQdmoU1AzfxsEmVnc5RfjGrWmAiqvfzmj4cCL3fJiiC", Networks.flo.network)
	 *
	 * var account = new Account(account_master, Networks.flo, false);
	 * var address = account.getNextChangeAddress()
	 * @return {Address}
	 */
	getNextChangeAddress(){
		// We use Chain 1 since that is the "Internal" chain used for generating change addresses.
		return this.getNextChainAddress(1)
	}
	/**
	 * Send a Payment to specified Addresses and Amounts, NOT YET IMPLEMENTED
	 * @param  {Object} options - the options for the specific transaction being sent
	 * @return {Promise<string>} - Returns a promise that will resolve to the success TXID
	 */
	sendPayment(options){
		
	}
	/**
	 * Get the Extended Private Key for the Account
	 * @example
	 * import bip32 from 'bip32'
	 * import { Account, Networks } from 'oip-hdmw'
	 * 
	 * var account_master = bip32.fromBase58("Fprv4xQSjQhWzrCVzvgkjam897LUV1AfxMuG8FBz5ouGAcbyiVcDYmqh7R2Fi22wjA56GQdmoU1AzfxsEmVnc5RfjGrWmAiqvfzmj4cCL3fJiiC", Networks.flo.network)
	 *
	 * var account = new Account(account_master, Networks.flo, false);
	 * var extPrivateKey = account.getExtendedPrivateKey()
	 * // extPrivateKey = Fprv4xQSjQhWzrCVzvgkjam897LUV1AfxMuG8FBz5ouGAcbyiVcDYmqh7R2Fi22wjA56GQdmoU1AzfxsEmVnc5RfjGrWmAiqvfzmj4cCL3fJiiC
	 * @return {string}
	 */
	getExtendedPrivateKey(){
		return this.account_master.toBase58()
	}
	/**
	 * Get the Extended Public Key for the Account
	 * @example
	 * import bip32 from 'bip32'
	 * import { Account, Networks } from 'oip-hdmw'
	 * 
	 * var account_master = bip32.fromBase58("Fprv4xQSjQhWzrCVzvgkjam897LUV1AfxMuG8FBz5ouGAcbyiVcDYmqh7R2Fi22wjA56GQdmoU1AzfxsEmVnc5RfjGrWmAiqvfzmj4cCL3fJiiC", Networks.flo.network)
	 *
	 * var account = new Account(account_master, Networks.flo, false);
	 * var extPublicKey = account.getExtendedPublicKey()
	 * // extPublicKey = Fpub1BPo8vEQqDkoDQmDqcJ8WFHD331AMpd7VU7atCJsix8xbHwN6K9wfDLjZKnW9fUw5uJg8UJMLhQ5W7gTxv6DbkfPoeJbBpMaUHrULxzVnSy
	 * @return {string}
	 */
	getExtendedPublicKey(){
		return this.account_master.neutered().toBase58()
	}
	/**
	 * Get the specified Chain number
	 * @param {number} chain_number - The number of the chain you are requesting
	 * @example <caption>Get Chain 0</caption>
	 * import bip32 from 'bip32'
	 * import { Account, Networks } from 'oip-hdmw'
	 * 
	 * var account_master = bip32.fromBase58("Fprv4xQSjQhWzrCVzvgkjam897LUV1AfxMuG8FBz5ouGAcbyiVcDYmqh7R2Fi22wjA56GQdmoU1AzfxsEmVnc5RfjGrWmAiqvfzmj4cCL3fJiiC", Networks.flo.network)
	 *
	 * var account = new Account(account_master, Networks.flo, false);
	 * var chain = account.getChain(0)
	 * @return {bip32utilschain}
	 */
	getChain(chainNumber){
		return this.account.getChain(chainNumber)
	}
	_discoverChain(chainNumber, gapLimit, queryCallback, callback) {
		var chains = this.account.getChains()
		var chain = chains[chainNumber].clone()

		discovery(chain, gapLimit, queryCallback, chainNumber, (err, used, checked, chainIndex) => {
			if (err) return callback(err)

			// throw away EACH unused address AFTER the last unused address
			var unused = checked - used
			for (var j = 1; j < unused; ++j) chain.pop()

			// override the internal chain
			this.account.chains[chainIndex] = chain

			callback(err, used, checked)
		})
	}
	/**
	 * Discover Used and Unused addresses for a specified Chain number
	 * @param  {number} chain_number - The number of the chain you wish to discover
	 * @example <caption>Discover Chain 0</caption>
	 * import bip32 from 'bip32'
	 * import { Account, Networks } from 'oip-hdmw'
	 * 
	 * var account_master = bip32.fromBase58("Fprv4xQSjQhWzrCVzvgkjam897LUV1AfxMuG8FBz5ouGAcbyiVcDYmqh7R2Fi22wjA56GQdmoU1AzfxsEmVnc5RfjGrWmAiqvfzmj4cCL3fJiiC", Networks.flo.network)
	 *
	 * var account = new Account(account_master, Networks.flo, false);
	 * account.discoverChain(0).then((acc) => {
	 * 	console.log(acc.getChain(0).addresses)
	 * })
	 * @return {Promise<Account>} - A Promise that once finished will resolve to the Account (now with discovery done)
	 */
	discoverChain(chain_number){
		return new Promise((resolve, reject) => {
			this._discoverChain(chain_number, GAP_LIMIT, (addresses, callback) => {
				var results = {};

				var checkComplete = () => {
					var done = true;
					for (var a of addresses){
						if (results[toBase58(a.address.publicKey, this.coin.network.pubKeyHash)] === undefined){
							done = false
						}
					}

					if (done){
						callback(null, results);
					}
				}

				for (var addr of addresses){
					var address = new Address(addr, this.coin, false);

					address.updateState().then((ad) => {
						if (ad.getTotalReceived() > 0){
							results[ad.getPublicAddress()] = true

							this.addresses[ad.getPublicAddress()] = ad;
						} else {
							results[ad.getPublicAddress()] = false
						}

						checkComplete()
					}).catch(callback)
				}
			}, (err, used, checked) => {
				if (err) 
					reject(err)

				this.discovery[chain_number] = { lastUpdate: Date.now() }

				resolve(this, chain_number)
			})
		})
	}
	/**
	 * Discover all Chains if we haven't in the past 30 minutes
	 * @example
	 * import bip32 from 'bip32'
	 * import { Account, Networks } from 'oip-hdmw'
	 * 
	 * var account_master = bip32.fromBase58("Fprv4xQSjQhWzrCVzvgkjam897LUV1AfxMuG8FBz5ouGAcbyiVcDYmqh7R2Fi22wjA56GQdmoU1AzfxsEmVnc5RfjGrWmAiqvfzmj4cCL3fJiiC", Networks.flo.network)
	 *
	 * var account = new Account(account_master, Networks.flo, false);
	 * account.discoverChainsIfNeeded().then((acc) => {
	 * 	console.log(acc.getChain(0).addresses)
	 * 	console.log(acc.getChain(1).addresses)
	 * })
	 * @return {Promise<Account>} - A Promise that once finished will resolve to the Account (now with discovery done)
	 */
	discoverChainsIfNeeded(){
		return new Promise((resolve, reject) => {
			var chainsToDiscover = []

			for (var chain in this.discovery){
				if (!this.discovery[chain] || this.discovery[chain].lastUpdate < (Date.now() - CHAIN_EXPIRE_TIMEOUT)){
					chainsToDiscover.push(this.discovery[chain].index)
				}
			}

			var checkIfComplete = () => {
				if (chainsToDiscover.length === 0)
					resolve(this);
			}

			for (var c of chainsToDiscover){
				this.discoverChain(c).then((account, chainNumber) => {
					chainsToDiscover.splice(chainsToDiscover.indexOf(chainNumber))
					checkIfComplete();
				}).catch(console.error);
			}
		})
	}
}

module.exports = Account