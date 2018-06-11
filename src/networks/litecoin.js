import { Insight } from 'insight-explorer'
import { networks } from 'bitcoinjs-lib'

var litecoinFeePerKb = 100000

var n = networks.litecoin;

n.slip44 = 2;

module.exports = {
	name: 'litecoin',
	displayName: 'Litecoin',
	ticker: 'LTC',
	satPerCoin: 1e8,
	feePerKb: litecoinFeePerKb,
	feePerByte: litecoinFeePerKb / 1024,
	maxFeePerByte: 100,
	minFee: litecoinFeePerKb,
	dust: 54600,

	txVersion: 1,

	explorer: new Insight('https://insight.litecore.io/api'),

	getExtraBytes: function(options){ return },

	network: networks.litecoin
}