require('dotenv').config()
const rp = require('request-promise')
const NodeCache = require( "node-cache" );
const myCache = new NodeCache({stdTTL: 4200, checkperiod: 120});

setInterval(async function(){
    await main()
},3600000)

async function main(){
    try{
        if (!myCache.get('counter') || myCache.get('counter') === 24){
            myCache.set('counter', 1)
            const trendingVideos = await getTrendingFor24Hours()
            console.log('trendingVideos',trendingVideos)
            myCache.set('trendingVideos', trendingVideos)
            try{
                const postId = await postOnFacebook(trendingVideos)
                console.log('Posted on facebook',postId)
            }catch(e){
                console.error('Error in posting data',e)
            }
        }else{
            myCache.set('counter', parseInt(myCache.get('counter')) + 1)
            try{
                const trendingVideos = myCache.get('trendingVideos')
                const postId = await postOnFacebook(trendingVideos)
                console.log('Posted on facebook',postId)
            }catch(e){
                console.error('Error in posting data',e)
            }
        }
    }catch(e){
        console.error('Error in a process',e)   
    }
}

async function getTrendingFor24Hours(){
    let trendingVideos = []
    try{
        const response = await rp(
            {   
                method: 'GET',
                uri: `https://www.googleapis.com/youtube/v3/videos`, 
                qs: {
                    key: process.env.youtubeAccessToken,
                    chart : 'mostPopular',
                    part:'snippet,statistics',
                    regionCode : 'IN',
                    maxResults:50
                },
                json: true
            }
        )
        trendingVideos = response.items.map(el=>{
            return {
                id : el.id,
                publishedAt:el.snippet.publishedAt,
                title:el.snippet.title,
                channelTitle:el.snippet.channelTitle,
                viewCount:el.statistics.viewCount
            }
        })
        return {list:trendingVideos}
    }catch(e){
        console.error('Error in getting data from youtube',e)
    }
}

async function postOnFacebook(trendingVideos){
    const currentVideoToPost = trendingVideos.list[0]
    trendingVideos.list.shift()
    myCache.set('trendingVideos', trendingVideos)
    const data = {
        message : `Title:${currentVideoToPost.title} \n
                Published On : ${currentVideoToPost.publishedAt} \n
                Channel Title : ${currentVideoToPost.channelTitle} \n
                View Count : ${currentVideoToPost.viewCount}`,
        link :`https://www.youtube.com/watch?v=${currentVideoToPost.id}`
    }
    postId = await rp(
        {   
            method: 'POST',
            uri: `https://graph.facebook.com/v7.0/${process.env.pageId}/feed`, 
            qs: {
                access_token: process.env.fbAccessToken,
                ...data 
            },
            json: true
        }
    )
    return postId
}