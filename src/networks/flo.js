import { Insight } from 'insight-explorer'
import { varIntBuffer } from '../util'

var floFeePerKb = 10000

module.exports = {
	name: 'flo',
	displayName: 'Flo',
	ticker: 'FLO',
	satPerCoin: 1e8,
	feePerKb: floFeePerKb,
	feePerByte: floFeePerKb / 1024,
	maxFeePerByte: 100,
	minFee: floFeePerKb,
	dust: 100000,

	txVersion: 2,

	explorer: new Insight('https://livenet.flocha.in/api'),

	getExtraBytes: function(options){
		var fData = options.floData || ""
		return varIntBuffer(fData.length).toString("hex") + Buffer.from(fData).toString("hex")
	},

	network: {
		bip32: {
			public: 0x0134406b,
			private: 0x01343c31
		},
		slip44: 216,
		messagePrefix: '\x1bFlorincoin Signed Message:\n',
		pubKeyHash: 35,
		scriptHash: 94,
		wif: 163
	}
}