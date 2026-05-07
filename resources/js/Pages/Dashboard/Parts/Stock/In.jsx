import React from 'react'
import StockCreate from './Create'
export default function In(props) {
    // reuse Create page but fix type to 'in'
    return <StockCreate {...props} type="in" />
}
