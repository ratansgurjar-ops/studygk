import React from 'react'
import { Helmet } from 'react-helmet-async'

export default function Contact(){
  return (
    <div style={{maxWidth:760,margin:'20px auto',padding:'0 18px'}}>
      <Helmet>
        <title>Contact — StudyGKHub</title>
        <meta name="description" content="Contact StudyGKHub" />
      </Helmet>
      <h1>Contact</h1>
      <p>If you need to reach us for support or inquiries, please email us at <a href="mailto:service@studygkhub.com">service@studygkhub.com</a>.</p>
      <p>We do not list phone contact on this page.</p>
    </div>
  )
}
