import React from 'react'
import StockCreate from './Create'
export default function Out(props) {
    // reuse Create page but fix type to 'out'
    return <StockCreate {...props} type="out" />
}
