chrome.tabs.executeScript({
    code: `
    /*
    Fine tune the playback speed of popular streaming services, including Netflix, HBO Max, Amazon Prime Video, and YouTube, from 0.1x to 10x speed. Now includes support for aCloudGuru. Use the slider bar, or the plus/minus keys. Backspace to reset to 1x.

    Slow playback to 0.1x so you can see sleight of hand in magic tricks, or watch an action scene unfold in slow motion. Speed up an audiobook 3x or DIY video 10x so you can get through them more quickly. Binge watch an entire 10 hour season on 3.3x speed in 3 (I suggest turning captions on at higher speeds)
    
    Use + or - keys on your keyboard to change playback speed in increments of 0.1x, or slide the orange bar below the video to adjust speed with your mouse.
    Reset it to the default speed by pressing Backspace.
    
    A new auto hide feature has been added so the slider bar doesn't interfere with full screen viewing. It appears when you move your mouse or press the +/- keys and 
    then disappears after a few seconds.
    */
    let container
    let source
    if (document.location.href.includes('youtube')){
        source = 'youtube'
        container = document.getElementsByClassName('style-scope ytd-video-primary-info-renderer')[0]
    } else if (document.location.href.includes('netflix')){
        source = 'netflix'
        container = document.getElementsByClassName('watch-video')[0]
    } else if (document.location.href.includes('amazon')){
        source = 'amazon'
        container = document.getElementsByClassName('webPlayerSDKContainer')[0]
    } else if (document.location.href.includes('hbo')){
        source = 'hbo'
        container = document.getElementsByClassName('default')[17]
    } else if (document.location.href.includes('acloud.guru')){
        source = 'acloudguru'
        container = document.getElementsByClassName('player-fullscreen-wrapper')[0]
    }
    
    let slider = document.getElementById('speedSlider');
    let video
    if (source === 'amazon'){
        vid_elem = document.getElementsByTagName('video')
        video = vid_elem[vid_elem.length-1]
    } else {
        video = document.getElementsByTagName('video')[0];
    }
    if (!slider){
        let br = document.createElement('br');

        let div = document.createElement('div');
        div.id = 'sliderContainer';
        if (source === 'youtube') {
            div.style.cssText = 'position: relative; margin: 0 auto 3rem';
        } else if (source === 'netflix'){
            div.style.cssText = 'position: relative; margin: 0px auto 3rem; z-index: 9999'
        } else if (source === 'amazon'){
            div.style.cssText = 'position: relative; margin: 0px auto 3rem; z-index: 9999; width: 100%'
        } else if (source === 'hbo'){
            div.style.cssText = 'position: relative; margin: 0px auto 3rem; z-index: 9999'
        } else if (source === 'acloudguru'){
            div.style.cssText = 'position: absolute; margin: 0px auto 3rem; z-index: 9999; width: 100%'
        }


        let title = document.createElement('span');
        title.id = 'sliderTitle';
        title.innerText = 'Change video speed';
        title.style.cssText = 'color: rgb(221, 149, 15); font-size: 1.5em; text-align: center;'

        let sliderLabel = document.createElement('output');
        sliderLabel.id = 'sliderLabel';
        sliderLabel.innerText = '1';
        sliderLabel.style.cssText = 'position: absolute; background-color: rgb(221, 149, 15); color: white; font-size: 1.5em; text-align: center; padding: 3px 8px; top: 105%;'

        let resetButton = document.createElement('button');
        resetButton.id = 'resetButton';
        resetButton.innerText = 'Reset'
        resetButton.style.cssText = 'float: right; color: rgb(221, 149, 15); background: none; font-size: 1.5em; text-align: center; border: 1px solid grey; border-radius: 1px; margin-bottom: 3px;'

        range = document.createElement('input');
        range.type = 'range';
        range.id = 'speedSlider';
        range.setAttribute('min', '0.1');
        range.setAttribute('max', '10');
        range.setAttribute('step', '0.1');
        range.setAttribute('value', '1');
        range.style.cssText = '-webkit-appearance: none; background-color: rgb(221, 149, 15); opacity: 0.9; width: 100%;'

        div.prepend(br);
        div.appendChild(title);
        div.appendChild(resetButton);
        div.appendChild(sliderLabel);
        div.appendChild(br);
        div.appendChild(range);
        div.appendChild(br);
        container.prepend(div);
    } 

    slider = document.getElementById('speedSlider');
    let resetButton = document.getElementById('resetButton');

    function updateSpeed(){
        video.playbackRate = slider.value;
        updateSliderLabel(video.playbackRate)
    }

    function resetSpeed(){
        slider.value = 1.0;
        video.playbackRate = 1;
        updateSliderLabel(video.playbackRate)
    }

    function updateSliderLabel(speed){
        if (source === 'netflix' || source === 'amazon' || source === 'hbo' ) {
            showAndHideSlider()
        }
        let sliderLabel = document.getElementById('sliderLabel');
        let currentSpeed = speed.toString();
        if (currentSpeed.length === 1){
            currentSpeed = currentSpeed + '.0';
        }
        let sliderVal = speed * 10
        sliderLabel.innerText = currentSpeed;
        sliderLabel.style.left = 'calc(' + sliderVal + '% + (' + (8 - sliderVal * 0.4) + 'px))';
    }

    let fadingOut = false
    function showAndHideSlider(){
        let sliderContainer = document.getElementById('sliderContainer')
        sliderContainer.style.display = 'block'
        if (!fadingOut) {
            let fadeOut = setTimeout(()=>{
                sliderContainer.style.display = 'none'; fadingOut = false;
            }, 3000)
            fadingOut = true
            }
    }

    function changeSpeedWithKeys(event){
        if (event.keyCode ===  187 && video.playbackRate < 10){
            video.playbackRate = (video.playbackRate += 0.1).toFixed(1)
        }
        if (event.keyCode === 189 && video.playbackRate > 0.1){
            video.playbackRate = (video.playbackRate -= 0.1).toFixed(1)
        }
        if (event.keyCode  === 8){
            video.playbackRate = 1.0
        }
        updateSliderLabel(video.playbackRate.toFixed(1))
        slider.value = video.playbackRate.toFixed(1)
    }               

    slider.addEventListener('mouseup', updateSpeed)
    resetButton.addEventListener('click', resetSpeed)
    document.addEventListener('keydown', changeSpeedWithKeys)
    if (source !== 'youtube'){
        document.addEventListener('mousemove', showAndHideSlider)
    }
    updateSliderLabel(1)
    if (source === 'hbo'){
        let elements = [...document.getElementsByTagName("*")]
        for (let i in elements){
            elements[i].style.cursor = 'none'
        }
        document.addEventListener('mousemove', () => {
            for (let i in elements){
                elements[i].style.cursor = 'auto'
            }
            setTimeout(()=>{
                for (let i in elements){
                    elements[i].style.cursor = 'none'
                }
            }, 3000)
        })
    }
    if (source === 'acloudguru'){
        let resetButton = document.getElementById('resetButton')
        resetButton.style.right = '10vw'
        resetButton.style.position = 'absolute'
    }
    `
})
