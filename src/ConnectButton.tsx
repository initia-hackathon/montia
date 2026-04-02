import { useInterwovenKit } from "@initia/interwovenkit-react"
import { useAccount } from "wagmi"

function truncateAddress(addr: string) {
  if (addr.length <= 12) return addr
  return addr.slice(0, 8) + "..." + addr.slice(-4)
}

export function ConnectButton() {
  const { address, username, openConnect, openWallet } = useInterwovenKit()
  const { connector } = useAccount()

  if (!address) {
    return (
      <button className="wallet-btn" onClick={openConnect}>
        Connect Wallet
      </button>
    )
  }

  const displayName = username || truncateAddress(address)

  return (
    <button className="wallet-btn connected" onClick={openWallet}>
      {connector?.icon && (
        <img src={connector.icon} alt="" className="wallet-icon" />
      )}
      {displayName}
    </button>
  )
}
