import {clsx, type ClassValue} from 'clsx'
import {twMerge} from 'tailwind-merge'

/** Объединяет классы компонентов, разрешая конфликтующие Tailwind-утилиты. */
export function cn(...inputs:ClassValue[]):string {return twMerge(clsx(inputs))}
