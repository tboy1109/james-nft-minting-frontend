import React, { useState, useEffect, Fragment } from 'react';
import { useTimer } from 'react-timer-hook';
import logo from '../assets/logo.png';

import { providers, Contract, BigNumber } from 'ethers'
import { ToastContainer, toast } from 'react-toastify'
import { BounceLoader } from 'react-spinners'
import { MerkleTree } from 'merkletreejs'
import keccak256 from 'keccak256'

import { contractAddr } from '../constants'
import abi from '../constants/abi'
import whitelists from '../constants/whitelist.json'

import bigVideo from '../assets/video_for_bg.mp4'

import 'react-toastify/dist/ReactToastify.css'

//Rinkeby
// const chainConfig = {
//   chainId: '0x4',
//   chainName: 'Rinkeby Testnet',
//   nativeCurrency: {
//     name: 'ETH',
//     symbol: 'ETH',
//     decimals: 18
//   },
//   rpcUrls: ['https://rinkeby.infura.io/v3/a96c6b2710b64f2380bf6045c1e9e13d'],
//   blockExplorerUrls: ['https://rinkeby.etherscan.io']
// }
//Mainnet
const chainConfig = {
  chainId: '0x1',
  chainName: 'Ethereum Mainnet',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: ['https://mainnet.infura.io/v3/a96c6b2710b64f2380bf6045c1e9e13d'],
  blockExplorerUrls: ['https://etherscan.io']
}

let nftContract, signer, provider, tree, root, contract

const Home = () => {
  const [timer] = useState(Date.UTC(2022, 5, 21, 15, 0, 0));
  const [walletAddress, setWalletAddress] = useState('')
  const [totalMinted, setTotalMinted] = useState(0)
  const [saleState, setSaleState] = useState(0)
  const [presalePrice, setPresalePrice] = useState()
  const [pubsalePrice, setPubsalePrice] = useState()
  const [loading, setLoading] = useState(false)
  const [minted, setMinted] = useState(0)

  useEffect(() => {
    (async () => {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainConfig.chainId }],
        })
      } catch (switchError) {
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [chainConfig],
            })
          } catch (err) {
            console.log('error adding chain:', err)
          }
        }
      }
      provider = new providers.Web3Provider(window.ethereum);
      provider.on('accountsChanged', (accounts) => {
        setWalletAddress(accounts[0])
      });
      tree = new MerkleTree(whitelists, keccak256, {
        hashLeaves: true,
        sortPairs: true
      })
      root = tree.getRoot().toString('hex')
      console.log('root:', root)
      setLoading(true)
      contract = new Contract(contractAddr, abi, new providers.JsonRpcProvider(chainConfig.rpcUrls[0]))
      const minted = await contract.totalMinted()
      setTotalMinted(minted.toNumber())
      const slstate = await contract.saleState()
      setSaleState(slstate)
      setPresalePrice(await contract.PRESALE_PRICE())
      setPubsalePrice(await contract.PUBSALE_PRICE())
      setLoading(false)
    })()
  }, [])

  const { seconds, minutes, hours, days } = useTimer({
    expiryTimestamp: timer,
    onExpire: () => console.warn('onExpire called'),
  });

  const formatTimer = timeUnit => `${timeUnit < 10 ? '0' : ''}${timeUnit}`;

  const connectWallet = async () => {
    if (!!walletAddress) {
      return
    }
    setLoading(true)
    await provider.send("eth_requestAccounts", []);
    provider.on('accountsChanged', (accounts) => {
      setWalletAddress(accounts[0])
    });
    signer = provider.getSigner();
    const wallet = await signer.getAddress()
    setWalletAddress(wallet)
    nftContract = new Contract(contractAddr, abi, signer)
    const mintedCnt = await nftContract.minted(wallet)
    setMinted(mintedCnt.toNumber())
    setLoading(false)
  }

  const mint = async amount => {
    if (!walletAddress) {
      return toast.error('Connect your wallet')
    }
    if (saleState === 0) {
      return toast.error('Sale is not started')
    }
    const balance = await provider.getBalance(walletAddress)
    console.log('balance:', balance)
    if (saleState === 1) {
      if (!whitelists.includes(walletAddress)) {
        return toast.error('You are not whitelist member')
      }
      if (minted + amount > 2) {
        return toast.error('Exceeds max amount in presale')
      }
      if (balance.lt(presalePrice.mul(amount))) {
        return toast.error('Insufficient fund')
      }
      setLoading(true)
      const proof = tree.getHexProof(keccak256(walletAddress))
      let tx = await nftContract.mint(proof, amount, { from: walletAddress, value: presalePrice.mul(amount) })
      await tx.wait()
    } else {
      if (balance.lt(pubsalePrice.mul(amount))) {
        return toast.error('Insufficient fund')
      }
      setLoading(true)
      let tx = await nftContract.mint([], amount, { from: walletAddress, value: pubsalePrice.mul(amount) })
      await tx.wait()
    }
    toast.success('Minting Success')
    setLoading(false)
    const tminted = await contract.totalMinted()
    setTotalMinted(tminted.toNumber())
    const mintedCnt = await contract.minted(walletAddress)
    setMinted(mintedCnt.toNumber())
  }

  return (
    <div className='home'>
      <div className='home__bg'>
        <video loop autoPlay muted className='home--video big-video'>
          <source src={bigVideo} type='video/mp4' />
        </video>
        <div className='small-video back-image'></div>
      </div>{' '}
      <div className='home__topBar'>
        <button className='home__topBar--button' onClick={e => connectWallet()} style={{ width: !!walletAddress ? '11rem' : '8rem' }}>
          <span>{!!walletAddress ? `${walletAddress.substr(0, 6)}...${walletAddress.substr(walletAddress.length - 4, 4)}` : 'Connect'}</span>
        </button>

        <h2 className='home__topBar--timer'>
          {days}D:{formatTimer(hours)}H:{formatTimer(minutes)}M:
          {formatTimer(seconds)}S
        </h2>
      </div>
      <div className='main-panel'>
        <img src={logo} alt='' className='logo-moon' />
        <div className='minted'>{totalMinted}/569</div>
        <div className='btn-panel'>
          <button className='mint-btn' onClick={e => mint(1)}>
            <span>Mint 1</span>
          </button>
          <button className='mint-btn' onClick={e => mint(2)}>
            <span>Mint 2</span>
          </button>
        </div>
      </div>
      <ToastContainer />
      {loading && <div style={{ width: '100%', height: '100%', position: 'fixed', top: '0px', left: '0px', background: 'white', opacity: '50%', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}><BounceLoader color='#36D7B7' /></div>}
    </div>
  );
};

export default Home;
