import React from "react";
import { ethers } from "ethers";
import { SessionKeyManagerModule } from "@biconomy/modules";
import { BiconomySmartAccountV2 } from "@biconomy/account"
import { DEFAULT_SESSION_KEY_MANAGER_MODULE  } from "@biconomy/modules";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Console } from "console";

interface props {
  smartAccount: BiconomySmartAccountV2;
  provider: ethers.providers.Provider;
  address: string;
  tokenA: ethers.Contract | undefined;
  tokenB: ethers.Contract | undefined;
  mockPool: ethers.Contract | undefined;
  mockStake: ethers.Contract | undefined;
  abiSVMAddress: string;
  sessionIDs: string[];
}

const MakeActions: React.FC<props> = ({ 
  smartAccount, 
  provider, 
  address,
  tokenA,
  tokenB,
  mockPool,
  mockStake,
  abiSVMAddress,
  sessionIDs
}) => {


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
    console.log(toastMessage);
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
      //console.log("sessionKeyPrivKey", sessionKeyPrivKey);
      if (!sessionKeyPrivKey) {
        alert("Session key not found please create session");
        return;
      }
      
      // USE SESION KEY AS SIGNER
      const sessionSigner = new ethers.Wallet(sessionKeyPrivKey);
      //console.log("sessionSigner", sessionSigner);

      // generate sessionModule
      const sessionModule = await SessionKeyManagerModule.create({
        moduleAddress: DEFAULT_SESSION_KEY_MANAGER_MODULE,
        smartAccountAddress: address,
      });
      
      // set active module to sessionModule
      smartAccount = smartAccount.setActiveValidationModule(sessionModule);
      
      const tx = {
        to: to, 
        data: data,
        value: value,
      };

      //console.log("tx", tx);

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

      //console.log("userOp", userOp);

      // send user op
      const userOpResponse = await smartAccount.sendUserOp(userOp, {
        sessionSigner: sessionSigner,
        sessionValidationModule: abiSVMAddress,
        sessionID: sessionId,
      });

      //console.log("userOpHash %o for Session Id %s", userOpResponse, sessionId);

      const { receipt } = await userOpResponse.wait(1);
      console.log(message + " => Success");
      //console.log("txHash", receipt.transactionHash);
      const polygonScanlink = `https://mumbai.polygonscan.com/tx/${receipt.transactionHash}`
      console.log("Check tx: ", polygonScanlink);
      toast.success(<a target="_blank" href={polygonScanlink}>Success Click to view transaction</a>, {
        position: "top-right",
        autoClose: 6000,
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

    return(
      <div>
          {
            <div>
              <button onClick={async() => {
                  const { data } = await tokenA.populateTransaction.approve(
                    mockPool.address, // spender address
                    ethers.utils.parseUnits("1234".toString(), 18)
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
          {
            <div>
              <button onClick={async() => {
                  const { data } = await tokenB.populateTransaction.approve(
                    mockStake.address, // spender address
                    ethers.utils.parseUnits("200".toString(), 18)
                  );
                  await sendUserOpWithData(tokenB.address, data, "0", sessionIDs[2], "Approving Token B to Stake");
                }
              }>Approve Token B to Stake</button>
            </div>
          }
          {
            <div>
              <button onClick={async() => {
                  const { data } = await mockStake.populateTransaction.stake(
                    ethers.utils.parseUnits("50".toString(), 18)
                  );
                  await sendUserOpWithData(mockStake.address, data, "0", sessionIDs[3], "Staking Token B");
                }
              }>Stake Token B</button>
            </div>
          }
          {
            <div>
              <button onClick={async() => {
                  const { data } = await mockStake.populateTransaction.withdraw(
                    ethers.utils.parseUnits("40".toString(), 18)
                  );
                  await sendUserOpWithData(mockStake.address, data, "0", sessionIDs[4], "Withdrawing Token B from Staking");
                }
              }>Withdraw Token B from Staking</button>
            </div>
          }
        </div>
    )
  }
  
  export default MakeActions;
