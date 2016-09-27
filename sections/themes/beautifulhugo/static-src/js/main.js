// Dean Attali / Beautiful Jekyll 2016

import $ from 'jquery/dist/jquery.slim';

let bigImgEl = null;
let numImgs = null;

module.exports = {
  init,
};

function init() {
  // Shorten the navbar after scrolling a little bit down
  $(window).scroll(() => {
    if ($('.navbar').offset().top > 50) {
      $('.navbar').addClass('top-nav-short');
    } else {
      $('.navbar').removeClass('top-nav-short');
    }
  });

  // On mobile, hide the avatar when expanding the navbar menu
  $('#main-navbar').on('show.bs.collapse', () => {
    $('.navbar').addClass('top-nav-expanded');
  });
  $('#main-navbar').on('hidden.bs.collapse', () => {
    $('.navbar').removeClass('top-nav-expanded');
  });

  // On mobile, when clicking on a multi-level navbar menu, show the child links
  $('#main-navbar').on('click', '.navlinks-parent', (e) => {
    const target = e.target;
    $.each($('.navlinks-parent'), (key, value) => {
      if (value === target) {
        $(value).parent().toggleClass('show-children');
      } else {
        $(value).parent().removeClass('show-children');
      }
    });
  });

  // show the big header image
  initImgs();
}

function initImgs() {
  // If the page was large images to randomly select from, choose an image
  if ($('#header-big-imgs').length < 1) {
    return;
  }
  bigImgEl = $('#header-big-imgs');
  numImgs = bigImgEl.attr('data-num-img');

  // 2fc73a3a967e97599c9763d05e564189
  // set an initial image
  const imgInfo = getImgInfo();
  const src = imgInfo.src;
  const desc = imgInfo.desc;
  setImg(src, desc);

  // If there are multiple images, cycle through them
  if (numImgs > 1) {
    getNextImg();
  }
}

// For better UX, prefetch the next image so that it will already be loaded when we want to show it
function getNextImg() {
  const imgInfo = getImgInfo();
  const src = imgInfo.src;
  const desc = imgInfo.desc;

  const prefetchImg = new Image();
  prefetchImg.src = src;
  // if I want to do something once the image is ready: `prefetchImg.onload = function(){}`

  setTimeout(() => {
    const img = $('<div></div>')
      .addClass('big-img-transition')
      .css('background-image', `url(${src})`);
    $('.intro-header.big-img').prepend(img);
    setTimeout(() => { img.css('opacity', '1'); }, 50);

    // after the animation of fading in the new image is done, prefetch the next one
    //img.one('transitioned webkitTransitionEnd oTransitionEnd MSTransitionEnd', function(){
    setTimeout(() => {
      setImg(src, desc);
      img.remove();
      getNextImg();
    }, 1000);
      //});
  }, 6000);
}

function getImgInfo() {
  const randNum = Math.floor((Math.random() * numImgs) + 1);
  const src = bigImgEl.attr(`data-img-src-${randNum}`);
  const desc = bigImgEl.attr(`data-img-desc-${randNum}`);

  return {
    src,
    desc,
  };
}

function setImg(src, desc) {
  $('.intro-header.big-img').css('background-image', `url(${src})`);
  if (typeof desc !== typeof undefined && desc !== false) {
    $('.img-desc')
      .text(desc)
      .show();
  } else {
    $('.img-desc').hide();
  }
}

// 2fc73a3a967e97599c9763d05e564189
