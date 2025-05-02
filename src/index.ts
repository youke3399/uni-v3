import { Alchemy, Network } from "alchemy-sdk";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const poolAddress = "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"; // weth/usdt
const swapTopic = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"; // Swap event topic

const poolAbi = [
    "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)"
];

const iface = new ethers.Interface(poolAbi);

const alchemy = new Alchemy({
    apiKey: process.env.ALCHEMY_API_KEY,
    network: Network.ETH_MAINNET,
});

// 获取 WebSocket 连接
const ws = alchemy.ws;

// 错误监听
ws.on('error', (error: unknown) => {
    console.error('Unknown error occurred:', error);
});

// 监听事件
ws.on(
    { address: poolAddress, topics: [swapTopic] },
    (log) => {
        try {
            const parsed = iface.parseLog(log);
            if (!parsed) {
                console.warn('Unable to parse log:', log);
                return;
            }
            handleSwap(
                parsed.args.sender,
                parsed.args.recipient,
                parsed.args.amount0,
                parsed.args.amount1,
                parsed.args.sqrtPriceX96,
                parsed.args.liquidity,
                parsed.args.tick,
                log.transactionHash
            );
        } catch (error) {
            console.error("Error:", error);
        }
    }
);

function handleSwap(
    sender: string,
    recipient: string,
    amount0: bigint,
    amount1: bigint,
    sqrtPriceX96: bigint,
    liquidity: bigint,
    tick: number,
    transactionHash: string
): void {
    const timestamp = new Date().toISOString();

    const amount0Formatted = ethers.formatUnits(amount0, 18);
    const amount1Formatted = ethers.formatUnits(amount1, 6);

    console.log(`\n=== [${timestamp}] Swap Detected ===`);
    console.log(`Transaction Hash: ${transactionHash}`);
    console.log(`Sender: ${sender}`);
    console.log(`Recipient: ${recipient}`);
    console.log(`Amount0 weth: ${amount0Formatted}`);
    console.log(`Amount1 usdt: ${amount1Formatted}`);
    console.log(`Current sqrtPriceX96: ${sqrtPriceX96.toString()}`);

    const Q96 = BigInt(2) ** BigInt(96);
    const sqrtPriceX96Number = Number(sqrtPriceX96.toString());
    const Q96Number = 2 ** 96;
    const price = (sqrtPriceX96Number / Q96Number) ** 2;
    const adjustedPrice = price * 1e12; // 调整 decimals: 18 - 6 = 12
    console.log(`Price (usdt/weth from sqrtPriceX96): ${adjustedPrice.toFixed(2)}`);

    // 计算实际 swap 的成交价格
    const executedPrice = Math.abs(Number(amount1Formatted)) / Math.abs(Number(amount0Formatted));
    console.log(`Executed Price (usdt/weth): ${executedPrice.toFixed(2)}`);

    console.log(`Liquidity: ${liquidity.toString()}`);
    console.log(`Tick: ${tick}`);
}

// 捕获未处理的异常和拒绝
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});
