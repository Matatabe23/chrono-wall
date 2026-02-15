export type PlatformType = 'android' | 'ios' | 'windows' | 'macos' | 'linux' | null

export interface DeviceInfo {
	platform: PlatformType
	isMobile: boolean
}

/**
 * Определяет платформу и тип устройства (мобильное/десктоп).
 * В Tauri использует plugin-os, в браузере — userAgent.
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
	try {
		const { type } = await import('@tauri-apps/plugin-os')
		const osType = type()
		return {
			platform: osType as PlatformType,
			isMobile: osType === 'android' || osType === 'ios',
		}
	} catch {
		// Не Tauri (браузер) — определяем по userAgent
		const ua = navigator.userAgent || ''
		const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
		const platform: PlatformType = mobile ? (ua.includes('Android') ? 'android' : 'ios') : null
		return {
			platform,
			isMobile: mobile,
		}
	}
}
