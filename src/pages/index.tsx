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
  SessionKeyManagerModule, 
  DEFAULT_ECDSA_OWNERSHIP_MODULE, 
  DEFAULT_SESSION_KEY_MANAGER_MODULE,
} from "@biconomy/modules";
import { Contract, ethers  } from 'ethers'
import { ChainId } from "@biconomy/core-types"
import {
  IPaymaster,
  BiconomyPaymaster,
} from '@biconomy/paymaster'
import CreateSession from '@/components/CreateSession';
import { toast, ToastContainer } from 'react-toastify';
import ERC20Transfer from '@/components/ERC20Transfer';
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

  const [sessionIDs, setSessionIDs] = useState<string[]>([]);

  const [abiSVMAddress, setAbiSVMAddress] = useState<string>("0x1431610824308bCDfA7b6F9cCB451d370f2a2F01");

  const refreshBalances = async () => {
    if(tokenA && tokenB) {
      try {
        const accTokenABalance = await tokenA.balanceOf(address)
        const accTokenBBalance = await tokenB.balanceOf(address)
        const stakeContractTokenBBalance = await tokenB.balanceOf("0x2C3aC29AFF6cbFCAeFb3EB3C13763141f79FC70B")
        const saToPoolTokenAAllowance = await tokenA.allowance(address, mockPool.address)
        
        setSaTokenABalance(ethers.utils.formatUnits(accTokenABalance, 18))
        setSaTokenBBalance(ethers.utils.formatUnits(accTokenBBalance, 18))
        setStakeContractBalance(ethers.utils.formatUnits(stakeContractTokenBBalance, 18))
        setSAtoPoolTokenAAllowance(ethers.utils.formatUnits(saToPoolTokenAAllowance, 18))
      } catch(err: any) {
        console.error(err)
      }
    }
    console.log("Balances Refreshed")
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

  

  /** 
   * 
   * BUILD AND SEND USER OP
   * 
  */

  const sendUserOpWithData = async (
    to: string,
    data: string,
    value: string,
    sessionId: string,
    message?: string
  ) => {
    if (!address || !smartAccount || !address) {
      alert('Connect wallet first');
      return;
    }

    const toastMessage = message + " " + sessionId;
    try {
      toast.info(toastMessage, {
        position: "top-right",
        autoClose: 15000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
        });
      
      // get session key from local storage
      const sessionKeyPrivKey = window.localStorage.getItem("sessionPKey");
      console.log("sessionKeyPrivKey", sessionKeyPrivKey);
      if (!sessionKeyPrivKey) {
        alert("Session key not found please create session");
        return;
      }
      
      // USE SESION KEY AS SIGNER
      const sessionSigner = new ethers.Wallet(sessionKeyPrivKey);
      console.log("sessionSigner", sessionSigner);

      // generate sessionModule
      const sessionModule = await SessionKeyManagerModule.create({
        moduleAddress: DEFAULT_SESSION_KEY_MANAGER_MODULE,
        smartAccountAddress: address,
      });
      
      // set active module to sessionModule
      //smartAccount = smartAccount.setActiveValidationModule(sessionModule);
      const smartAccountWithSKMActivated = smartAccount.setActiveValidationModule(sessionModule);
      setSmartAccount(smartAccountWithSKMActivated);

      const tx = {
        to: to, 
        data: data,
        value: value,
      };

      console.log("tx", tx);

      // build user op
      let userOp = await smartAccount.buildUserOp([tx], {
        overrides: {
          // signature: "0x0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000456b395c4e107e0302553b90d1ef4a32e9000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000db3d753a1da5a6074a9f74f39a0a779d3300000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000001800000000000000000000000000000000000000000000000000000000000000080000000000000000000000000bfe121a6dcf92c49f6c2ebd4f306ba0ba0ab6f1c000000000000000000000000da5289fcaaf71d52a80a254da614a192b693e97700000000000000000000000042138576848e839827585a3539305774d36b96020000000000000000000000000000000000000000000000000000000002faf08000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000041feefc797ef9e9d8a6a41266a85ddf5f85c8f2a3d2654b10b415d348b150dabe82d34002240162ed7f6b7ffbc40162b10e62c3e35175975e43659654697caebfe1c00000000000000000000000000000000000000000000000000000000000000"
          // callGasLimit: 2000000, // only if undeployed account
          // verificationGasLimit: 700000
        },
        skipBundlerGasEstimation: false,
        params: {
          sessionSigner: sessionSigner,
          sessionValidationModule: abiSVMAddress,
          sessionID: sessionId,
        },
      });

      console.log("userOp", userOp);

      // send user op
      const userOpResponse = await smartAccount.sendUserOp(userOp, {
        sessionSigner: sessionSigner,
        sessionValidationModule: abiSVMAddress,
        sessionID: sessionId,
      });

      console.log("userOpHash %o for Session Id %s", userOpResponse, sessionId);

      const { receipt } = await userOpResponse.wait(1);
      console.log("txHash", receipt.transactionHash);
      const polygonScanlink = `https://mumbai.polygonscan.com/tx/${receipt.transactionHash}`
      toast.success(<a target="_blank" href={polygonScanlink}>Success Click to view transaction</a>, {
        position: "top-right",
        autoClose: 18000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
        });
    } catch(err: any) {
      console.error(err);
    }
  }

  return (
    <>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={`${styles.main} ${inter.className}`}>
        <div className={styles.description}>
          <p>
            Get started by editing&nbsp;
            <code className={styles.code}>src/pages/index.tsx</code>
          </p>
          <div>
            <a
              href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
              target="_blank"
              rel="noopener noreferrer"
            >
              By{" "}
              <Image
                src="/vercel.svg"
                alt="Vercel Logo"
                className={styles.vercelLogo}
                width={100}
                height={24}
                priority
              />
            </a>
          </div>
        </div>

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
              setSessionIDs={setSessionIDs}
            />
          )
        }

        {
          smartAccount && provider && (
            <ERC20Transfer
              smartAccount={smartAccount}
              provider={provider}
              address={address}
            />
          )
        }

        <div>
          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="dark"
          />
          {
            <div>
              <button onClick={async() => {
                  const { data } = await tokenA.populateTransaction.approve(
                    mockPool.address, // spender address
                    ethers.utils.parseUnits("1002".toString(), 18)
                  );
                  await sendUserOpWithData(tokenA.address, data, "0", sessionIDs[0], "Approving Token A to Pool");
                }
              }>Approve Token A to Pool</button>
            </div>
          }
          {
            <div>
              <button onClick={async() => {
                  const { data } = await mockPool.populateTransaction.swapExactTokensForTokens(
                    ethers.utils.parseUnits("99".toString(), 18),
                    ethers.utils.parseUnits("99".toString(), 18),
                    ethers.utils.hexlify(0),
                  );
                  await sendUserOpWithData(mockPool.address, data, "0", sessionIDs[1], "Swapping Token A to Token B");
                }
              }>Swap Token A to Token B</button>
            </div>
          }
        </div>
        <div>
          <h2>Balances</h2>
          <p>Smart Account Token A Balance: {saTokenABalance}</p>
          <p>Smart Account Token B Balance: {saTokenBBalance}</p>
          <p>Stake Contract Token B Balance: {stakeContractBalance}</p>
          <p>Token A allowance from SA to Pool: {SAtoPoolTokenAAllowance}</p>
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
  );
}
