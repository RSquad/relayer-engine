import { Environment, StandardRelayerApp } from "../../../lib/esm/relayer/index.js";
const CHAIN_ID_TON = 62 as number;

(async function main() {
    // initialize relayer engine app, pass relevant config options
    const app = new StandardRelayerApp(
        Environment.TESTNET,
        {
            name: "TonRelayer",
            spyEndpoint: "ws://localhost:7073",
            providers: {
                chains: {
                    [CHAIN_ID_TON]: {
                        endpoints: [
                            // replace with your TON RPC endpoint
                            "https://testnet.toncenter.com/api/v2/jsonRPC?api_key=",
                        ],
                    },
                },
            },
        },
    );

    // add a filter with a callback that will be
    // invoked on finding a VAA that matches the filter
    app.chain(CHAIN_ID_TON).address(
        "kQCiBxdRqIyPiphjYwGWxrMC0DPnb7YYv6hRLRBs18b3ytZy", // emitter address on TON
        // callback function to invoke on new message
        async (ctx, next) => {
            ctx.logger.info(
                `Got a VAA with sequence: ${ctx.vaa?.sequence} from with txhash: ${ctx.sourceTxHash}`,
            );

            }
    );

    // start app, blocks until unrecoverable error or process is stopped
    await app.listen();
})();