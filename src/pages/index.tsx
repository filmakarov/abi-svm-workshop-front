import Head from "next/head";
import Image from "next/image";
import { Inter } from "next/font/google";
import styles from "@/styles/Home.module.css";

import Head from 'next/head'
import styles from '@/styles/Home.module.css'
import { useState, useEffect } from 'react';
import { IBundler, Bundler } from '@biconomy/bundler'
import { BiconomySmartAccountV2, DEFAULT_ENTRYPOINT_ADDRESS } from "@biconomy/account"
import { 
  ECDSAOwnershipValidationModule, 
  DEFAULT_ECDSA_OWNERSHIP_MODULE, 
} from "@biconomy/modules";
import { Contract, ethers  } from 'ethers'
import { ChainId } from "@biconomy/core-types"
import {
  IPaymaster,
  BiconomyPaymaster,
} from '@biconomy/paymaster'
import CreateSession from '@/components/CreateSession';
import { toast, ToastContainer } from 'react-toastify';
import erc20Abi from "@/utils/erc20Abi.json"
import mockPoolAbi from "@/utils/mockPool.json"
import mockStakeAbi from "@/utils/mockStake.json"


export default function Home() {
  const [address, setAddress] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false);
  const [smartAccount, setSmartAccount] = useState<BiconomySmartAccountV2 | null>(null);
  const [provider, setProvider] = useState<ethers.providers.Provider | null>(null)


  const [tokenA, setTokenA] = useState<Contract>();
  const [tokenB, setTokenB] = useState<Contract>();
  const [mockPool, setMockPool] = useState<Contract>();
  const [mockStake, setMockStake] = useState<Contract>();
  
  const [saTokenABalance, setSaTokenABalance] = useState<string>("0");
  const [saTokenBBalance, setSaTokenBBalance] = useState<string>("0");
  const [stakeContractBalance, setStakeContractBalance] = useState<string>("0");
  const [SAtoPoolTokenAAllowance, setSAtoPoolTokenAAllowance] = useState<string>("0");
  const [SAtoStakeTokenBAllowance, setSAtoStakeTokenBAllowance] = useState<string>("0");
  const [SAStakeBalance, setSAStakeBalance] = useState<string>("0");

  const [abiSVMAddress, setAbiSVMAddress] = useState<string>("0x1431610824308bCDfA7b6F9cCB451d370f2a2F01");

  const refreshBalances = async () => {
    if(tokenA && tokenB) {
      try {
        const accTokenABalance = await tokenA.balanceOf(address)
        const accTokenBBalance = await tokenB.balanceOf(address)
        const stakeContractTokenBBalance = await tokenB.balanceOf("0x2C3aC29AFF6cbFCAeFb3EB3C13763141f79FC70B")
        const saToPoolTokenAAllowance = await tokenA.allowance(address, mockPool.address)
        const saToStakeTokenBAllowance = await tokenB.allowance(address, mockStake.address)
        const saStakeBalance = await mockStake.balances(address)
        
        setSaTokenABalance(ethers.utils.formatUnits(accTokenABalance, 18))
        setSaTokenBBalance(ethers.utils.formatUnits(accTokenBBalance, 18))
        setStakeContractBalance(ethers.utils.formatUnits(stakeContractTokenBBalance, 18))
        setSAtoPoolTokenAAllowance(ethers.utils.formatUnits(saToPoolTokenAAllowance, 18))
        setSAtoStakeTokenBAllowance(ethers.utils.formatUnits(saToStakeTokenBAllowance, 18))
        setSAStakeBalance(ethers.utils.formatUnits(saStakeBalance, 18))
      } catch(err: any) {
        console.error(err)
      }
    }
    //console.log("Balances Refreshed")
  }

  useEffect(() => {
    refreshBalances()
  },[address, smartAccount, provider])

  const bundler: IBundler = new Bundler({
    //https://dashboard.biconomy.io/
    bundlerUrl: "https://bundler.biconomy.io/api/v2/80001/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44",
    chainId: ChainId.POLYGON_MUMBAI,
    entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
  })

  const paymaster: IPaymaster = new BiconomyPaymaster({
    //https://dashboard.biconomy.io/
    paymasterUrl: "https://paymaster.biconomy.io/api/v1/80001/bN77UefF7.145fff89-e5e1-40ec-be11-7549878eb08f"
  })

  const connect = async () => {
    // @ts-ignore
    const { ethereum } = window;
    try {
      setLoading(true)
      const provider = new ethers.providers.Web3Provider(ethereum)
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const ownerShipModule = await ECDSAOwnershipValidationModule.create({
        signer: signer,
        moduleAddress: DEFAULT_ECDSA_OWNERSHIP_MODULE
      })
      setProvider(provider)
      let biconomySmartAccount = await BiconomySmartAccountV2.create({
        chainId: ChainId.POLYGON_MUMBAI,
        bundler: bundler,
        paymaster: paymaster,
        entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
        defaultValidationModule: ownerShipModule,
        activeValidationModule: ownerShipModule
      })
      setAddress(await biconomySmartAccount.getAccountAddress())
      setSmartAccount(biconomySmartAccount)

      const tokenA = new ethers.Contract(
        "0xC23027a83c48eebf2aa3e045576C72c3f6b3eb61",
        erc20Abi,
        provider
      );
      setTokenA(tokenA);
      const tokenB = new ethers.Contract(
        "0xa8008EFc52cCAbA2012608349E5C76A25D5c752D",
        erc20Abi,
        provider
      );
      setTokenB(tokenB);
      const mockPool = new ethers.Contract(
        "0x40Ad19a280cdD7649981A7c3C76A5D725840efCF",
        mockPoolAbi,
        provider
      );
      setMockPool(mockPool);
      const mockStake = new ethers.Contract(
        "0x2C3aC29AFF6cbFCAeFb3EB3C13763141f79FC70B",
        mockStakeAbi,
        provider
      );
      setMockStake(mockStake);
      setLoading(false)
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <h1>ABI SVM Demo</h1>
        {!loading && !address && <button onClick={connect} className={styles.connect}>Connect to Web3</button>}
        {loading && <p>Loading Smart Account...</p>}
        {address && <h2>Smart Account: {address}</h2>}

        {
          smartAccount && provider && (
            <CreateSession
              smartAccount={smartAccount}
              address={address}
              provider={provider}
              tokenA={tokenA}
              tokenB={tokenB}
              mockPool={mockPool}
              mockStake={mockStake}
              abiSVMAddress={abiSVMAddress}
            />
          )
        }

        <div>
          <h2>Balances</h2>
          <p>Smart Account Token A Balance: {saTokenABalance}</p>
          <p>Smart Account Token B Balance: {saTokenBBalance}</p>
          <p>Stake Contract Token B Balance: {stakeContractBalance}</p>
          <p>Token A allowance from SA to Pool: {SAtoPoolTokenAAllowance}</p>
          <p>Token B allowance from SA to Stake: {SAtoStakeTokenBAllowance}</p>
          <p>SA's Balance on the Stake Protocol: {SAStakeBalance}</p>
          <p> <button onClick={refreshBalances}>Refresh</button> </p>
        </div>

        <div className={styles.grid}>
          <a
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
            className={styles.card}
            target="_blank"
            rel="noopener noreferrer"
          >
            <h2>
              Docs <span>-&gt;</span>
            </h2>
            <p>
              Find in-depth information about Next.js features and&nbsp;API.
            </p>
          </a>

          <a
            href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
            className={styles.card}
            target="_blank"
            rel="noopener noreferrer"
          >
            <h2>
              Learn <span>-&gt;</span>
            </h2>
            <p>
              Learn about Next.js in an interactive course with&nbsp;quizzes!
            </p>
          </a>

          <a
            href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
            className={styles.card}
            target="_blank"
            rel="noopener noreferrer"
          >
            <h2>
              Templates <span>-&gt;</span>
            </h2>
            <p>
              Discover and deploy boilerplate example Next.js&nbsp;projects.
            </p>
          </a>

          <a
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
            className={styles.card}
            target="_blank"
            rel="noopener noreferrer"
          >
            <h2>
              Deploy <span>-&gt;</span>
            </h2>
            <p>
              Instantly deploy your Next.js site to a shareable URL
              with&nbsp;Vercel.
            </p>
          </a>
        </div>
      </main>
    </>
  )
}
