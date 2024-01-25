import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { SessionKeyManagerModule, DEFAULT_SESSION_KEY_MANAGER_MODULE  } from "@biconomy/modules";
import { BiconomySmartAccountV2 } from "@biconomy/account"
import { defaultAbiCoder } from "ethers/lib/utils";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {getABISVMSessionKeyData} from "@/utils/sessionKey";

interface props {
  smartAccount: BiconomySmartAccountV2;
  address: string;
  provider: ethers.providers.Provider;
  tokenA: ethers.Contract | undefined;
  tokenB: ethers.Contract | undefined;
  mockPool: ethers.Contract | undefined;
  mockStake: ethers.Contract | undefined;
  abiSVMAddress: string;
  setSessionIDs: React.Dispatch<React.SetStateAction<any[]>>;
}

const CreateSession: React.FC<props> = ({ 
    smartAccount, address, provider, tokenA, tokenB, mockPool, mockStake, abiSVMAddress, setSessionIDs
}) => {

    const [isSessionKeyModuleEnabled, setIsSessionKeyModuleEnabled] = useState <boolean>(false);
    const [isSessionActive, setIsSessionActive] = useState <boolean>(false);

    useEffect(() => {
        let checkSessionModuleEnabled = async () => {
          if(!address || !smartAccount || !provider) {
            setIsSessionKeyModuleEnabled(false);
            return
          }
          try {
            const isEnabled = await smartAccount.isModuleEnabled(DEFAULT_SESSION_KEY_MANAGER_MODULE)
            console.log("isSessionKeyModuleEnabled", isEnabled);
            setIsSessionKeyModuleEnabled(isEnabled);
            return;
          } catch(err: any) {
            console.error(err)
            setIsSessionKeyModuleEnabled(false);
            return;
          }
        }
        checkSessionModuleEnabled() 
      },[isSessionKeyModuleEnabled, address, smartAccount, provider])

      const createSession = async (enableSessionKeyModule: boolean) => {
        const toastMessage = 'Creating Sessions for ' + address; 
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
        if (!address || !smartAccount || !provider) {
          alert("Please connect wallet first")
        }
        try {
          // -----> setMerkle tree tx flow
          // create dapp side session key
          const sessionSigner = ethers.Wallet.createRandom();
          const sessionKeyEOA = await sessionSigner.getAddress();
          console.log("sessionKeyEOA", sessionKeyEOA);
          // BREWARE JUST FOR DEMO: update local storage with session key
          window.localStorage.setItem("sessionPKey", sessionSigner.privateKey);
    
          // generate sessionModule
          const sessionModule = await SessionKeyManagerModule.create({
            moduleAddress: DEFAULT_SESSION_KEY_MANAGER_MODULE,
            smartAccountAddress: address,
          });
    
          /**
           * Create Session Key Datas
           */
    
          let sessionKeyDatas = [];
          
          // Operation 1: Approve token A to Pool
          const sessionKeyData1 = await getABISVMSessionKeyData(
            sessionKeyEOA,
            {
              destContract: tokenA.address,
              functionSelector: ethers.utils.hexDataSlice(
                ethers.utils.id("approve(address,uint256)"),
                0,
                4
              ), // approve function selector
              valueLimit: ethers.utils.parseEther("0"), // value limit
              // array of offsets, values, and conditions
              rules: [
                {
                  offset: 0,
                  condition: 0,
                  referenceValue: ethers.utils.hexZeroPad(mockPool.address, 32),
                }, // equal
                {
                  offset: 32,
                  condition: 1, // less than or equal;
                  referenceValue: ethers.utils.hexZeroPad(
                    "0x21E19E0C9BAB2400000",
                    32
                  ), // 0x21E19E0C9BAB2400000 = hex(1e^23) = 10,000 tokens
                },
              ],
            }
          )
          sessionKeyDatas.push(sessionKeyData1);
    
          // Operation 2: Swap Token A to Token B
          const sessionKeyData2 = await getABISVMSessionKeyData(
            sessionKeyEOA,
            {
              destContract: mockPool.address,
              functionSelector: ethers.utils.hexDataSlice(
                ethers.utils.id("swapExactTokensForTokens(uint256,uint256,uint256)"),
                0,
                4
              ), // approve function selector
              valueLimit: ethers.utils.parseEther("0"), // value limit
              // array of offsets, values, and conditions
              rules: [
                {
                  offset: 0,
                  condition: 1, // less than or equal;
                  referenceValue: ethers.utils.hexZeroPad(
                    "0x3635C9ADC5DEA00000",
                    32
                  ), // 0x3635C9ADC5DEA00000 = hex(10^21) = 1,000 tokens
                }, 
                {
                  offset: 32,
                  condition: 1, // less than or equal;
                  referenceValue: ethers.utils.hexZeroPad(
                    "0x3635C9ADC5DEA00000",
                    32
                  ), // 0x3635C9ADC5DEA00000 = hex(10^21) = 1,000 tokens
                },
                {
                  offset: 64,
                  condition: 0, // equal;
                  referenceValue: ethers.utils.hexZeroPad(
                    ethers.utils.hexlify(0), // swap direction = 0 = tokenA=>tokenB
                    32
                  ),
                },
              ],
            }
          )
          sessionKeyDatas.push(sessionKeyData2);
    
          const sessionObjects = sessionKeyDatas.map((sessionKeyData) => {
            return {
              validUntil: 0,
              validAfter: 0,
              sessionValidationModule: abiSVMAddress,
              sessionPublicKey: sessionKeyEOA,
              sessionKeyData: sessionKeyData,
            }
          })
          console.log("sessionObjects", sessionObjects);
    
          /**
           * Create Data for the Session Enabling Transaction
           * We pass an array of session data objects to the createSessionData method
           */
          const sessionTxData = await sessionModule.createSessionData(sessionObjects);
          console.log("sessionTxData", sessionTxData);
          setSessionIDs([...sessionTxData.sessionIDInfo]);
    
          // tx to set session key
          const setSessionTrx = {
            to: DEFAULT_SESSION_KEY_MANAGER_MODULE, // session manager module address
            data: sessionTxData.data,
          };
    
          const transactionArray = [];
    
          if (enableSessionKeyModule) {
            // -----> enableModule session manager module
            const enableModuleTrx = await smartAccount.getEnableModuleData(
              DEFAULT_SESSION_KEY_MANAGER_MODULE
            );
            transactionArray.push(enableModuleTrx);
          }
    
          transactionArray.push(setSessionTrx)
    
          let partialUserOp = await smartAccount.buildUserOp(transactionArray);
    
          const userOpResponse = await smartAccount.sendUserOp(
            partialUserOp
          );
          console.log(`userOp Hash: ${userOpResponse.userOpHash}`);
          const transactionDetails = await userOpResponse.wait();
          console.log("txHash", transactionDetails.receipt.transactionHash);
          setIsSessionActive(true)
          toast.success(`Success! Session created succesfully`, {
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
          console.error(err)
        }
      }

    return (
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
        {isSessionKeyModuleEnabled ? (
          <button onClick={() => createSession(false)}>Create Session</button>
        ) : (
          <button onClick={() => createSession(true)}>
            Enable Session Key Module and Create Session
          </button>
        )}
      </div>
    )
    
  }
  
  export default CreateSession;