import Sidebar from '@/components/Navbars/navbar'
import styles from './page.module.css'
import React from 'react'


const page = () => {
  return (
    <div className={styles.page}>
      <main className={styles.content}>
        <Sidebar />
      </main>
    </div>
  
    
  )
}

export default page
