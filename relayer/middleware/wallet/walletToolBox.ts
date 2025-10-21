import * as wh from "@certusone/wormhole-sdk";
import { ethers } from "ethers";
import * as solana from "@solana/web3.js";
import { Providers } from "../providers.middleware.js";
import {
  EVMWallet,
  SeiWallet,
  SolanaWallet,
  SuiWallet,
  TonWallet,
  Wallet,
} from "./wallet.middleware.js";
import { Ed25519Keypair, RawSigner } from "@mysten/sui.js";
import { DirectSecp256k1Wallet } from "@cosmjs/proto-signing";
import { keyPairFromSeed } from "@ton/crypto";
import {
  WalletContractV1R1,
  WalletContractV1R2,
  WalletContractV1R3,
  WalletContractV2R1,
  WalletContractV2R2,
  WalletContractV3R1,
  WalletContractV3R2,
  WalletContractV4,
  WalletContractV5R1,
} from "@ton/ton";

export interface WalletToolBox<T extends Wallet> extends Providers {
  wallet: T;
  address: string;

  getBalance(): Promise<string>;
}

export async function createWalletToolbox(
  providers: Providers,
  privateKey: string,
  chainId: wh.ChainId,
  walletVersion?: string
): Promise<WalletToolBox<any>> {
  if (wh.isEVMChain(chainId)) {
    return createEVMWalletToolBox(providers, privateKey, chainId);
  }
  switch (chainId) {
    case wh.CHAIN_ID_SOLANA:
      let secretKey;
      try {
        secretKey = ethers.utils.base58.decode(privateKey);
      } catch (e) {
        secretKey = new Uint8Array(JSON.parse(privateKey));
      }
      return createSolanaWalletToolBox(providers, secretKey);
    case wh.CHAIN_ID_SUI:
      const secret = Buffer.from(privateKey, "base64");
      return createSuiWalletToolBox(providers, secret);
    case wh.CHAIN_ID_SEI:
      const seiPkBuf = Buffer.from(privateKey, "hex");
      return createSeiWalletToolBox(providers, seiPkBuf);
      case wh.CHAIN_ID_TON:
        const seed =  Buffer.from(privateKey, "hex");
        return createTonWalletToolBox(providers, seed, walletVersion ?? "v4R2");
  }

  throw new Error(`Unknown chain id ${chainId}`);
}

function createEVMWalletToolBox(
  providers: Providers,
  privateKey: string,
  chainId: wh.EVMChainId,
): WalletToolBox<EVMWallet> {
  const chainProviders = providers.evm[chainId];
  if (chainProviders === undefined || chainProviders.length === 0) {
    throw new Error(`No provider found for chain ${chainId}`);
  }
  const wallet = new ethers.Wallet(privateKey, chainProviders[0]);
  return {
    ...providers,
    wallet: wallet,
    async getBalance(): Promise<string> {
      const b = await wallet.getBalance();
      return b.toString();
    },
    address: wallet.address,
  };
}

function createSolanaWalletToolBox(
  providers: Providers,
  privateKey: Uint8Array,
): WalletToolBox<SolanaWallet> {
  const keypair = solana.Keypair.fromSecretKey(privateKey);
  return {
    ...providers,
    wallet: {
      conn: providers.solana[0],
      payer: keypair,
    },
    async getBalance(): Promise<string> {
      return (
        await providers.solana[0].getBalance(keypair.publicKey)
      ).toString();
    },
    address: keypair.publicKey.toBase58(),
  };
}

function createSuiWalletToolBox(
  providers: Providers,
  secret: Buffer,
): WalletToolBox<SuiWallet> {
  const keyPair = Ed25519Keypair.fromSecretKey(secret);
  const suiProvider = providers.sui[0];
  const wallet = new RawSigner(keyPair, suiProvider);
  const address = keyPair.getPublicKey().toSuiAddress();
  return {
    ...providers,
    wallet,
    async getBalance(): Promise<string> {
      const b = await suiProvider.getBalance({
        owner: address,
      });
      return b.totalBalance.toString();
    },
    address: address,
  };
}

async function createSeiWalletToolBox(
  providers: Providers,
  privateKey: Buffer,
): Promise<WalletToolBox<SeiWallet>> {
  const seiWallet = await DirectSecp256k1Wallet.fromKey(privateKey, "sei");
  const [seiAccount] = await seiWallet.getAccounts();

  const seiProvider = providers.sei[0];

  return {
    ...providers,
    wallet: seiWallet,
    address: seiAccount.address,
    async getBalance(): Promise<string> {
      const b = await seiProvider.getBalance(seiAccount.address, "usei");
      return b.amount;
    },
  };
}

async function createTonWalletToolBox(
    providers: Providers,
    seed: Buffer,
    walletVersion: string,
): Promise<WalletToolBox<TonWallet>> {
  const keyPair = keyPairFromSeed(seed);

  const tonWallet = await createWalletByVersion(walletVersion,keyPair.publicKey)

  return {
    ...providers,
    wallet: tonWallet,
    address: tonWallet.address,
    async getBalance(): Promise<string> {
      return (
          await providers.ton[0].getBalance(keyPair.publicKey)
      ).toString();
    },
  };
}

function createWalletByVersion(version: string, publicKey: Buffer, workchain = 0): TonWallet {
  switch (version) {
    case "v1r1":
      return WalletContractV1R1.create({ workchain, publicKey });
    case "v1r2":
      return WalletContractV1R2.create({ workchain, publicKey });
    case "v1r3":
      return WalletContractV1R3.create({ workchain, publicKey });
    case "v2r1":
      return WalletContractV2R1.create({ workchain, publicKey });
    case "v2r2":
      return WalletContractV2R2.create({ workchain, publicKey });
    case "v3r1":
      return WalletContractV3R1.create({ workchain, publicKey });
    case "v3r2":
      return WalletContractV3R2.create({ workchain, publicKey });
    case "v4r1":
      return WalletContractV4.create({ workchain, publicKey });
    case "v4r2":
      return WalletContractV4.create({ workchain, publicKey });
    case "v5r1_final":
      return WalletContractV5R1.create({ workchain, publicKey });
    default:
      new Error(`invalid wallet version: ${version}`);
  }
}