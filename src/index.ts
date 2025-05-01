import { ethers, EventLog } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const poolAddress = "0xe42318eA3b998e8355a3Da364EB9D48eC725Eb45"; // weth/rpl

const poolAbi = [
    "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)"
];

let provider: ethers.WebSocketProvider;
let poolContract: ethers.Contract;
let lastActivityAt = Date.now();

// Swap 事件处理逻辑
async function handleSwap(
    sender: string,
    recipient: string,
    amount0: bigint,
    amount1: bigint,
    sqrtPriceX96: bigint,
    liquidity: bigint,
    tick: number,
    event: EventLog
): Promise<void> {
    lastActivityAt = Date.now();
    try {
        const timestamp = new Date().toISOString();

        const amount0Formatted = ethers.formatUnits(amount0, 18);
        const amount1Formatted = ethers.formatUnits(amount1, 18);

        // 获取 token0 和 token1 的信息
        // const token0 = new Token(1, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 18, "WETH", "Wrapped Ether");
        // const token1 = new Token(1, "0xD33526068D116cE69F19A9ee46F0bd304F21A51f", 18, "RPL", "Rocket Pool");

        console.log(`\n=== [${timestamp}] Swap Detected ===`);
        console.log(`Transaction Hash: ${event.transactionHash}`);
        console.log(`Sender: ${sender}`);
        console.log(`Recipient: ${recipient}`);
        console.log(`Amount0 weth: ${amount0Formatted}`);
        console.log(`Amount1 rpl: ${amount1Formatted}`);
        console.log(`Current sqrtPriceX96: ${sqrtPriceX96.toString()}`);
        const price = (sqrtPriceX96 * sqrtPriceX96) / (BigInt(2) ** BigInt(192));
        const priceFloat = Number(price.toString()) / 1e18;
        console.log(`Price (rpl/weth): ${priceFloat.toFixed(6)}`);
        const inversePrice = 1 / priceFloat;
        console.log(`Price (weth/rpl): ${inversePrice.toFixed(6)}`);
        console.log(`Liquidity: ${liquidity.toString()}`);
        console.log(`Tick: ${tick}`);

        const tx = await provider.getTransaction(event.transactionHash);
        if(tx){
            console.log(`From: ${tx.from}`);
        }else{
            console.warn(`Transaction not found for hash: ${event.transactionHash}`);
        }        

    } catch (err) {
        console.error("Error in handleSwap:", err);
    }
}

async function createProvider(): Promise<void> {
    try {
        provider = new ethers.WebSocketProvider(process.env.ALCHEMY_WSS_URL as string);
        provider.on('error', async (error: Error) => {
            console.error('WebSocket Error:', error);
            await reconnect();
        });

        poolContract = new ethers.Contract(poolAddress, poolAbi, provider);
        await setupSwapListener();

        // 每 12 秒检查一次连接状态
        setInterval(async () => {
            try {
                await provider.getBlockNumber();  // Ping to keep connection alive
            } catch (err) {
                console.error("WebSocket lost connection. Reconnecting...");
                await reconnect();
            }
        }, 12000);

        // 每 60 秒检查事件监听器是否仍然存在
        setInterval(async () => {
            await verifyEventBinding();
        }, 60000);

    } catch (err) {
        console.error("Failed to connect:", err);
        await reconnect();
    }
}

// 注册 Swap 事件监听器
async function setupSwapListener(): Promise<void> {
    await poolContract.removeAllListeners("Swap");
    poolContract.on("Swap", async (...args) => {
        const event = args[args.length - 1];
        if (!event || !event.transactionHash) {
            console.warn("Invalid event log received.");
            return;
        }
        try {
            const [
                sender,
                recipient,
                amount0,
                amount1,
                sqrtPriceX96,
                liquidity,
                tick
            ] = args as [
                string,
                string,
                bigint,
                bigint,
                bigint,
                bigint,
                number
            ];
            await handleSwap(sender, recipient, amount0, amount1, sqrtPriceX96, liquidity, tick, event);
        } catch (error) {
            console.error("Error in handleSwap:", error);
        }
    });
    lastActivityAt = Date.now();
    console.log("[Info] Swap listener attached.");
}

async function verifyEventBinding(): Promise<void> {
    if (!poolContract) {
        console.warn("[Warning] poolContract is null. Recreating...");
        await reconnect();
        return;
    }

    const now = Date.now();
    const secondsSinceLastActivity = (now - lastActivityAt) / 1000;

    if (secondsSinceLastActivity > 180) {
        console.warn(`[Warning] No Swap or Rebind in ${secondsSinceLastActivity.toFixed(0)}s. Rebinding listener...`);
        await setupSwapListener();
    } else {
        console.log(`[Info] Last activity ${secondsSinceLastActivity.toFixed(0)}s ago. No need to rebind.`);
    }
}

async function reconnect(): Promise<void> {
    try {
        if (poolContract) {
            await poolContract.removeAllListeners("Swap"); // 清理旧的合约事件监听器
            poolContract = null as unknown as ethers.Contract;
        }
        if (provider) {
            provider.removeAllListeners(); // 清理 provider 上的监听器
            provider = null as unknown as ethers.WebSocketProvider;
        }
    } catch (err) {
        console.error("Error during cleanup:", err);
    }
    setTimeout(() => {
        console.log("Reconnecting...");
        (async () => {
            await createProvider();
        })();
    }, 1000); // 1 秒后重连
}

createProvider();

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});
