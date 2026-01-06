import React from 'react'

export default function About(){
  return (
    <div style={{maxWidth:1000,margin:'28px auto',padding:20,background:'#fff',borderRadius:8,display:'grid',gap:24}}>
      <header style={{textAlign:'center'}}>
        <h1>About StudyGKHub</h1>
        <p style={{color:'#555',maxWidth:760,margin:'8px auto'}}>We help creators publish blog posts and brands get free editorial features to increase awareness and reach. Our platform focuses on quality content, ethical promotion and transparency.</p>
      </header>

      <section style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,alignItems:'start'}}>
        <div>
          <h3>Our Mission</h3>
          <p>To provide a free, trustworthy platform where brands and bloggers can share useful content, promote products ethically, and reach interested audiences.</p>
        </div>
        <div>
          <h3>How It Works</h3>
          <ol>
            <li>Submit your brand or blog details via the Request page.</li>
            <li>Our editorial team reviews submissions for compliance.</li>
            <li>Approved entries are published as informational posts or brand features.</li>
          </ol>
        </div>
      </section>

      <section style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
        <div>
          <h3>Submission Guidelines</h3>
          <ul>
            <li>Provide original, owned content only.</li>
            <li>Avoid prohibited categories (adult, illegal, misleading, etc.).</li>
            <li>Include clear descriptions, links and images where relevant.</li>
          </ul>
        </div>
        <div>
          <h3>Affiliate & Disclosure</h3>
          <p>We participate in affiliate programs (for example Amazon Associates). When applicable, affiliate links are disclosed on pages that use them and do not add extra cost to users.</p>
        </div>
      </section>

      <section style={{background:'#f9fafb',padding:16,borderRadius:8}}>
        <h3>Contact</h3>
        <p>For questions, removal requests or business enquiries please use the Contact page. We respond to valid requests and will not entertain abusive or fake requests.</p>
      </section>

      <footer style={{textAlign:'center',color:'#666',marginTop:6}}>© {new Date().getFullYear()} StudyGKHub — All rights reserved.</footer>
    </div>
  )
}
